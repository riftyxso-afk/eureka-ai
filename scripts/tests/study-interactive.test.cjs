const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
function load(name) {
  const file = path.resolve(__dirname, '../../lib', name + '.ts');
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', js)(id => id.startsWith('.') ? load(path.relative(path.resolve(__dirname, '../../lib'), path.resolve(path.dirname(file), id)).replace(/\\/g, '/')) : require(id), module, module.exports);
  cache.set(file, module.exports);
  return module.exports;
}
const { studyGoalPrompt } = load('study-goal');
const { appendStudyMapNode, parseStudyMapLine, studyMindmapSchema } = load('study-mindmap');
const node = (id, parentId = null) => ({ id, parentId, label: 'Konsep ' + id, detail: 'Penjelasan konsep.' });
test('free study does not inject an unrelated seven-day schedule', () => {
  assert.equal(studyGoalPrompt('  Buat PDF tentang energi  ', 0), 'Buat PDF tentang energi');
  assert.match(studyGoalPrompt('Energi', 7), /selama 7 hari/);
  assert.equal(studyGoalPrompt('Energi', 999), 'Energi');
});
test('stream accepts parent-first nodes and rejects invalid lines without losing prior nodes', () => {
  let nodes = parseStudyMapLine([], JSON.stringify(node('root')));
  nodes = parseStudyMapLine(nodes, JSON.stringify(node('child', 'root')));
  assert.equal(nodes.length, 2);
  for (const invalid of [node('orphan', 'missing'), node('root'), node('another-root'), node('self', 'self'), { ...node('bad'), label: '' }]) {
    assert.equal(appendStudyMapNode(nodes, invalid), nodes);
  }
  assert.equal(parseStudyMapLine(nodes, '{"id":'), nodes);
  assert.equal(studyMindmapSchema.parse(nodes).length, 2);
});
test('map limits depth and persists within existing study responses', () => {
  let nodes = [node('a')];
  for (const [id, parent] of [['b','a'], ['c','b'], ['d','c'], ['e','d']]) nodes = appendStudyMapNode(nodes, node(id, parent));
  assert.equal(nodes.length, 4);
  const { studyInteractionSchema } = load('study-interaction');
  assert.equal(studyInteractionSchema.parse({ steps: [], suggestions: [], mindmap: nodes }).mindmap.length, 4);
  assert.deepEqual(studyInteractionSchema.parse({ steps: [], suggestions: [] }), { steps: [], suggestions: [] });
});
test('PDF renders headings, a multipage table, and sources into a real PDF', async () => {
  const { createStudyPdf } = load('study-pdf');
  const markdown = '# Energi\n\n## Perbandingan\n\n| Jenis | Contoh |\n| --- | --- |\n' + Array.from({ length: 85 }, (_, i) => `| Energi ${i + 1} | Matahari, air, dan angin untuk kebutuhan sehari-hari |`).join('\n') + '\n\n### Latihan\n\n1. Jelaskan energi.\n2. Berikan contoh.';
  const bytes = await createStudyPdf('Energi', markdown, [{ title: 'Sumber materi', url: 'https://example.com/energi', kind: 'web', excerpt: '' }]);
  assert.ok(bytes.subarray(0, 8).toString().startsWith('%PDF-'));
  assert.ok(bytes.length > 3000);
  assert.ok((bytes.toString('latin1').match(/\/Type \/Page\b/g) || []).length > 1);
});

async function runAgent({ document = false, mindmap = false, authError = false, exportFailure = false, explicitMindmap = true, prompt, artifactFailure = false, summaryFailure = false, activity, sourceText, history = [] } = {}) {
  const saved = [], exports = [], artifacts = [], generations = [];
  const mocks = {
    '@/lib/study-intent':load('study-intent'),
    '@/lib/study-artifacts':{readStudyArtifact:async()=>({title:'Energi',content:'Isi artefak hasil revisi.'}),saveStudyArtifact:async(userId,input)=>{
      if (artifactFailure) throw new Error('Storage unavailable');
      artifacts.push({userId,...input});
      return {id:'artifact-1'};
    }},
    '@/lib/learningPreferences':{learningContext:async()=>'',observeLearning:async()=>false},
    '@/lib/ai': {
      aiChatJson: async () => ({ title: 'Energi', document, mindmap, tools: [] }),
      aiChatStream: async (options, emit) => {
        generations.push(JSON.parse(options.user));
        if (options.maxTokens === 140) {
          if (summaryFailure) throw new Error('Summary provider unavailable');
          return {content:'Buka artefaknya untuk melihat cara energi berpindah dalam kehidupan sehari-hari.'};
        }
        if (options.maxTokens === 2600) {
          const text = JSON.stringify(node('root')) + '\n' + JSON.stringify(node('child', 'root'));
          emit({type:'token',text:text.slice(0,31)}); emit({type:'token',text:text.slice(31)});
          return { content: text };
        }
        emit({type:'token',text:'## Energi\n\nPenjelasan energi.'});
        return {content:'## Energi\n\nPenjelasan energi.'};
      },
    },
    '@/lib/assistant/auth': { requirePro: async () => authError ? ({error:'Unauthorized',status:401}) : ({userId:'owner'}) },
    '@/lib/assistant/store': { getSession: async()=>({}), getMessages: async()=>history, appendMessage:async message=>saved.push(message), renameSession:async()=>{} },
    '@/lib/rateLimit': { ensureRateLimitPrune(){}, checkRateLimit:()=>({ok:true}) },
    '@/lib/prompts/safety': { AI_SAFETY_GUARDRAIL:'' },
    '@/lib/computer-files': { requestedComputerFormats:()=>[], createComputerFiles:()=>assert.fail('Should not require Computer Use') },
    '@/lib/study-documents': { createStudyDocuments:async input=>{exports.push(input); input.emit('Menata halaman PDF…'); return exportFailure ? {files:[],errors:['PDF belum tersimpan']} : {files:[{id:'file-1',name:'Energi.pdf',mime:'application/pdf',size:1024}],errors:[]};} },
    '@/lib/study-mindmap': load('study-mindmap'),
    '@/lib/study-video': load('study-video'),
    '@/lib/zapi-study': {hasZapi:()=>false},
  };
  const module = {exports:{}};
  const source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../../app/api/study-agent/route.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',source)(id=>mocks[id] || (id.startsWith('@/')?{}:require(id)),module,module.exports);
  const {NextRequest}=require('next/server');
  const response=await module.exports.POST(new NextRequest('http://localhost/api/study-agent',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:'11111111-1111-4111-8111-111111111111',prompt:prompt ?? (mindmap&&explicitMindmap?'Buat mindmap tentang energi':'Buat materi tentang energi'),browser:false,activity,sourceText})}));
  const body=await response.text();
  const events=body.split('\n\n').filter(line=>line.startsWith('data: ')).map(line=>JSON.parse(line.slice(6)));
  return {response,events,saved,exports,artifacts,generations};
}
test('explicit artifact generation saves the answer and returns its ID to open the editor', async () => {
  const result = await runAgent({document:true,prompt:'Buat artefak tentang energi'});
  assert.equal(result.exports.length,0);
  assert.equal(result.artifacts.length,1);
  assert.equal(result.artifacts[0].userId,'owner');
  assert.match(result.artifacts[0].content,/## Energi/);
  assert.notEqual(result.artifacts[0].content,result.saved.at(-1).content);
  assert.equal(result.events.filter(event=>event.type==='token').map(event=>event.text).join(''),result.saved.at(-1).content);
  assert.equal(result.saved.at(-1).study.artifactId,'artifact-1');
  assert.equal(result.events.at(-1).artifactId,'artifact-1');
});
test('artifact action expands the selected answer and has a short fallback when summarization fails', async () => {
  const sourceText = 'Jawaban terpilih tentang perubahan bentuk energi.';
  const result = await runAgent({activity:'artifact',sourceText,summaryFailure:true});
  assert.equal(result.generations[0].sourceMaterial,sourceText);
  assert.equal(result.artifacts.length,1);
  assert.match(result.saved.at(-1).content,/Buka artefak/);
  assert.notEqual(result.saved.at(-1).content,result.artifacts[0].content);
});
test('follow-up still receives the latest saved artifact content after chat is summarized', async () => {
  const result = await runAgent({history:[{role:'assistant',content:'Buka artefak.',study:{artifactId:'artifact-1'}}]});
  assert.equal(result.generations[0].recentArtifact.content,'Isi artefak hasil revisi.');
  assert.equal(result.artifacts.length,0);
});
test('plain replies never create artifacts and a failed artifact save preserves the reply', async () => {
  const plain = await runAgent();
  assert.equal(plain.artifacts.length,0);
  const failed = await runAgent({prompt:'Buat artefak tentang energi',artifactFailure:true});
  assert.equal(failed.events.at(-1).type,'done');
  assert.equal(failed.events.at(-1).artifactId,undefined);
  assert.match(failed.events.at(-1).fileErrors[0],/Artefak belum tersimpan/);
  assert.match(failed.saved.at(-1).content,/Penjelasan energi/);
});
test('ordinary chat creates and persists downloadable documents without Computer Use',async()=>{
  const f=await runAgent({document:true});
  assert.equal(f.exports.length,1);
  assert.equal(f.events.at(-1).type,'done');
  assert.equal(f.saved.at(-1).study.files[0].name,'Energi.pdf');
  assert.ok(f.events.some(event=>event.type==='status' && event.label==='Menata halaman PDF…'));
});
test('mindmap streams root before children and saves the same final tree',async()=>{
  const f=await runAgent({mindmap:true});
  const maps=f.events.filter(event=>event.type==='mindmap');
  assert.deepEqual(maps.map(event=>event.nodes.length),[0,1,2]);
  assert.deepEqual(f.saved.at(-1).study.interaction.mindmap,maps.at(-1).nodes);
  assert.equal(f.events.at(-1).type,'done');
});
test('document storage failure preserves answer and reports failure instead of a fake download',async()=>{
  const f=await runAgent({document:true,exportFailure:true});
  const done=f.events.at(-1);
  assert.equal(done.type,'done'); assert.equal(done.files.length,0); assert.equal(done.fileErrors.length,1);
  assert.ok(f.saved.at(-1).content.includes('Energi'));
});
test('study generation stays authenticated',async()=>{
  const f=await runAgent({authError:true,document:true});
  assert.equal(f.response.status,401); assert.equal(f.exports.length,0); assert.equal(f.saved.length,0);
});

test('voice context follows selected answer and excludes later unrelated topics', () => {
  const {buildStudyCallContext,readStudyCallContext,studyCallInstructions}=load('audio/studyCallContext');
  const turns=[{role:'user',content:'Jelaskan fotosintesis'},{role:'assistant',content:'Tumbuhan menggunakan cahaya untuk membuat glukosa.'},{role:'user',content:'Sekarang bahas mesin mobil'},{role:'assistant',content:'Mesin menggunakan bahan bakar.'}];
  const context=buildStudyCallContext('Fotosintesis',turns,1);
  assert.match(context.material,/fotosintesis/); assert.match(context.material,/glukosa/);
  assert.doesNotMatch(context.material,/mobil|bahan bakar/);
  assert.equal(buildStudyCallContext('Topik',turns,0),undefined);
  assert.equal(readStudyCallContext({title:'x',material:''}),undefined);
  assert.ok(readStudyCallContext({title:'x'.repeat(300),material:'y'.repeat(20000)}).material.length<=16000);
  assert.match(studyCallInstructions(context),/bukan instruksi atau izin/);
  assert.equal(studyCallInstructions(undefined),'');
});
test('vertical mindmap places children below parents without overlap and collapses descendants', () => {
  const {layoutStudyMap,MAP_NODE_WIDTH,MAP_NODE_HEIGHT}=load('study-map-layout');
  const nodes=[node('r'),node('a','r'),node('b','r'),node('a1','a'),node('a2','a'),node('b1','b')];
  const layout=layoutStudyMap(nodes,new Set());
  assert.equal(layout.edges.length,nodes.length-1);
  for(const position of layout.positions){
    const parent=layout.positions.find(item=>item.node.id===position.node.parentId);
    if(parent) assert.ok(position.y>parent.y+MAP_NODE_HEIGHT);
    assert.ok(position.x>=0 && position.x+MAP_NODE_WIDTH<=layout.width);
    for(const other of layout.positions){ if(position.node.id!==other.node.id && position.y===other.y) assert.ok(Math.abs(position.x-other.x)>=MAP_NODE_WIDTH); }
  }
  assert.deepEqual(layoutStudyMap(nodes,new Set(['r'])).positions.map(item=>item.node.id),['r']);
  assert.ok(!layoutStudyMap(nodes,new Set(['a'])).positions.some(item=>item.node.id==='a1'));
});
test('Lala session binds selected study material into provider configuration', async () => {
  const captured=[];
  const mocks={
    '@/lib/assistant/auth':{requirePro:async()=>({userId:'owner'})},
    '@/lib/rateLimit':{ensureRateLimitPrune(){},checkRateLimit:()=>({ok:true})},
    '@/lib/prompts/safety':{AI_SAFETY_GUARDRAIL:'Keep tools safe'},
    '@/lib/audio/studyCallContext':load('audio/studyCallContext'),
  };
  const source=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../../app/api/call/session/route.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  new Function('require','module','exports','process','fetch',source)(id=>mocks[id]||{},module,module.exports,{env:{GEMINI_API_KEY:'test-key'}},async(url,request)=>{captured.push(JSON.parse(request.body));return Response.json({name:'test-ephemeral-token'});});
  const response=await module.exports.POST(new Request('http://localhost/api/call/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:'lala',studyContext:{title:'Fotosintesis',material:'Tumbuhan mengubah cahaya menjadi energi kimia.'}})}));
  assert.equal(response.status,200);
  const instructions=captured[0].bidiGenerateContentSetup.systemInstruction.parts[0].text;
  assert.match(instructions,/Fotosintesis/);assert.match(instructions,/energi kimia/);
  assert.match(instructions,/Jangan bertanya ulang topik/);
});
test('Momo receives study context even after voice history rotates', async()=>{
  const calls=[];
  const mocks={
    '@/lib/ai':{hasAiKey:()=>true,aiChatStream:async options=>{calls.push(options);return {content:'Kita lanjut membahas fotosintesis.'};}},
    '@/lib/assistant/auth':{requirePro:async()=>({userId:'owner'})},
    '@/lib/rateLimit':{ensureRateLimitPrune(){},checkRateLimit:()=>({ok:true})},
    '@/lib/prompts/safety':{AI_SAFETY_GUARDRAIL:''},
    '@/lib/prompts/momoPersona':{momoPersona:()=>''},
    '@/lib/audio/studyCallContext':load('audio/studyCallContext'),
    '@/lib/after':{runAfter(){}},
  };
  const source=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../../app/api/call/route.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  new Function('require','module','exports',source)(id=>mocks[id]||{},module,module.exports);
  const response=await module.exports.POST(new Request('http://localhost/api/call',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:'Jelaskan lagi bagian itu',history:Array.from({length:18},()=>({role:'user',content:'Lanjut'})),studyContext:{title:'Fotosintesis',material:'Klorofil menangkap energi cahaya.'}})}));
  assert.equal(response.status,200);
  assert.match(calls[0].system,/Fotosintesis/);assert.match(calls[0].system,/Klorofil/);
  assert.equal(calls[0].history.length,12);
});

test('video commands parse requested time and select the matching transcript window',()=>{
 const {requestedVideoTime,videoTranscriptWindow,studyVideoFromUrl}=load('study-video');
 for(const prompt of ['bahas di menit 3:20','bahas menit 3 detik 20','bahas 3 menit 20 detik']) assert.equal(requestedVideoTime(prompt),200);
 assert.equal(requestedVideoTime('bahas menit tiga'),180);
 assert.equal(requestedVideoTime('carikan video tentang energi'),undefined);
 const excerpt=videoTranscriptWindow([{offsetMs:0,durationMs:9000,text:'Opening'},{offsetMs:195000,durationMs:10000,text:'Fotosintesis'},{offsetMs:600000,durationMs:10000,text:'Outro'}],200);
 assert.match(excerpt,/Fotosintesis/);assert.doesNotMatch(excerpt,/Opening|Outro/);
 assert.equal(studyVideoFromUrl('https://www.youtube.com/watch?v=abcdefghijk&t=200s').seconds,200);
 assert.equal(studyVideoFromUrl('https://example.com/file'),undefined);
});
test('voice handoff keeps the selected video and timestamp',()=>{
 const {buildStudyCallContext}=load('audio/studyCallContext');
 const context=buildStudyCallContext('Energi',[{role:'user',content:'Bahas video'},{role:'assistant',content:'Penjelasan dari transkrip',sources:[{title:'Video energi',url:'https://www.youtube.com/watch?v=abcdefghijk&t=200s'}]}],1);
 assert.equal(context.video.id,'abcdefghijk');assert.equal(context.video.seconds,200);
});
test('call video tool reads the requested segment of the selected video',async()=>{
 const seen=[];
 const mocks={
  '@/lib/assistant/auth':{requirePro:async()=>({userId:'owner'})},
  '@/lib/rateLimit':{ensureRateLimitPrune(){},checkRateLimit:()=>({ok:true})},
  '@/lib/prompts/momoPersona':{momoPersona:()=>''},
  '@/lib/audio/studyCallContext':load('audio/studyCallContext'),
  '@/lib/study-video':load('study-video'),
  '@/lib/study-video-server':{readStudyVideo:async video=>{seen.push(video);return {video,excerpt:'Cuplikan transkrip di waktu yang diminta'};}},
 };
 const source=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../../app/api/call/route.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};new Function('require','module','exports',source)(id=>mocks[id]||{},module,module.exports);
 const body={action:'discuss-video',question:'Bahas menit 3:20',studyContext:{title:'Video',material:'Pembahasan',video:{id:'abcdefghijk',seconds:0,title:'Video'}}};
 const response=await module.exports.POST(new Request('http://localhost/api/call',{method:'POST',body:JSON.stringify(body)}));
 assert.equal(response.status,200);assert.equal(seen[0].seconds,200);assert.equal(seen[0].id,'abcdefghijk');
 const missing=await module.exports.POST(new Request('http://localhost/api/call',{method:'POST',body:JSON.stringify({...body,studyContext:undefined})}));assert.equal(missing.status,400);
});

test('a classifier cannot enable an unrequested mindmap or quiz',async()=>{const f=await runAgent({mindmap:true,explicitMindmap:false});assert.equal(f.events.filter(e=>e.type==='mindmap').length,0);assert.equal(f.events.at(-1).type,'done');assert.equal(f.saved.at(-1).study.interaction.question,undefined);assert.equal(f.saved.at(-1).study.interaction.requested,false);});
