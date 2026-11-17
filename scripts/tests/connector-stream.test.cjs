const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
function load(file,mocks={}){
  const module={exports:{}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {module,exports:module.exports,require:name=>{
      if(name in mocks)return mocks[name];
      const source=path.join(path.dirname(file),name+'.ts');
      return name.startsWith('.')&&fs.existsSync(source)?load(source):require(name);
    },Buffer,process,console,AbortSignal,URL,URLSearchParams,fetch,setTimeout,TextDecoder});
  return module.exports;
}
test('connector credential encryption round-trips and rejects tampering',()=>{
  const before=process.env.CONNECTOR_ENCRYPTION_KEY;
  process.env.CONNECTOR_ENCRYPTION_KEY='a'.repeat(40);
  try{
    const service=load('lib/connectors/server.ts',{'@/lib/supabase/admin':{},'./catalog':{}});
    const sealed=service.seal({access_token:'private-token'});
    assert.equal(service.unseal(sealed).access_token,'private-token');
    assert.equal(sealed.includes('private-token'),false);
    const bytes=Buffer.from(sealed,'base64url');bytes[20]^=1;
    assert.throws(()=>service.unseal(bytes.toString('base64url')));
    delete process.env.CONNECTOR_ENCRYPTION_KEY;
    assert.throws(()=>service.seal('secret'),/CONNECTOR_ENCRYPTION_KEY/);
  }finally{if(before===undefined)delete process.env.CONNECTOR_ENCRYPTION_KEY;else process.env.CONNECTOR_ENCRYPTION_KEY=before;}
});
test('tool call reports running before connection lookup settles and reports failure honestly',async()=>{
  let release;const gate=new Promise(resolve=>release=resolve);
  const events=[];
  const tools=load('lib/connectors/tools.ts',{
    './productivity':{},'@/lib/ai':{},'@/lib/supabase/admin':{},
    './catalog':{CONNECTORS:[{id:'canva',name:'Canva'}]},
    './server':{connectorStates:()=>gate},
  });
  const pending=tools.connectorChatContext('user','session','Cari di Canva',[],new AbortController().signal,()=>{},call=>events.push(call));
  assert.equal(events.length,1);
  assert.equal(events[0].status,'running');
  release([]);
  const result=await pending;
  assert.equal(events.at(-1).status,'error');
  assert.match(result,/Hubungkan Canva/);
});

test('GitHub repository IDs reach the provider without document-ID validation', async()=>{
  let received;
  const tools=load('lib/connectors/tools.ts',{
    './productivity':{productivityTool:async(user,plan)=>{received=plan;return {html_url:'https://github.com/owner/repo/issues/1'};}},
    '@/lib/ai':{aiChatJson:async()=>({provider:'github',action:'read',id:'owner/repo',query:'bug',title:'',text:'',rows:[],fields:{},start:'',end:''})},
    '@/lib/supabase/admin':{},'./catalog':{CONNECTORS:[{id:'github',name:'GitHub'}]},
    './server':{connectorStates:async()=>[{provider:'github',permission:'read'}]},
  });
  const events=[];
  await tools.connectorChatContext('user','session','Baca GitHub owner/repo',[],new AbortController().signal,()=>{},e=>events.push(e));
  assert.equal(received.id,'owner/repo');
  assert.equal(events.at(-1).status,'completed');
});

test('Teams channel IDs preserve the colon within the actual channel ID', async()=>{
  let requested;
  const provider=load('lib/connectors/productivity.ts',{'./server':{accessToken:async()=>'test-token'}});
  const original=globalThis.fetch;
  // VM receives the mocked fetch at load time.
  globalThis.fetch=async url=>{requested=url;return {ok:true,json:async()=>({value:[]})};};
  try {
    const api=load('lib/connectors/productivity.ts',{'./server':{accessToken:async()=>'test-token'}});
    await api.productivityTool('user',{provider:'teams',action:'read',id:'team-guid:19:abc@thread.tacv2',query:'',title:'',text:''});
    assert.match(requested,/channels\/19%3Aabc%40thread.tacv2/);
  } finally {globalThis.fetch=original;}
});

test('an expired-token refresh cannot resurrect a disconnected grant',async()=>{
  const before=process.env.CONNECTOR_ENCRYPTION_KEY;
  process.env.CONNECTOR_ENCRYPTION_KEY='b'.repeat(40);
  let grant,updates=0,upserts=0;
  const database={from:()=>({
    select:()=>({eq(){return this;},maybeSingle:async()=>({data:grant})}),
    update:()=>{updates++;return {eq(){return this;},select(){return this;},maybeSingle:async()=>({data:null})};},
    upsert:()=>{upserts++;throw Error('must not upsert');}
  })};
  const original=globalThis.fetch;
  globalThis.fetch=async()=>({ok:true,json:async()=>({access_token:'new-token',expires_in:3600})});
  try {
    const server=load('lib/connectors/server.ts',{'@/lib/supabase/admin':{db:()=>database},'./catalog':{connectorById:()=>({group:'google',name:'Drive'})}});
    grant={credentials:server.seal({access_token:'old',refresh_token:'refresh'}),expires_at:new Date(0).toISOString(),permission:'read'};
    await assert.rejects(server.accessToken('user','drive'),/Koneksi berubah/);
    assert.equal(updates,1);assert.equal(upserts,0);
  }finally{globalThis.fetch=original;if(before===undefined)delete process.env.CONNECTOR_ENCRYPTION_KEY;else process.env.CONNECTOR_ENCRYPTION_KEY=before;}
});
test('SSE exposes tool updates before the network stream is closed',async()=>{
  const {readSseData}=load('lib/assistant/sse.ts');
  let controller;const encoder=new TextEncoder();
  const stream=new ReadableStream({start(c){controller=c;}});
  const iterator=readSseData(stream);
  controller.enqueue(encoder.encode('data: {"type":"tool_call","call":{"status":"running"}}\r\n\r\n'));
  assert.equal(JSON.parse((await iterator.next()).value).call.status,'running');
  controller.enqueue(encoder.encode('data: {"type":"tool_call","call":{"status":"completed"}}\n\n'));
  assert.equal(JSON.parse((await iterator.next()).value).call.status,'completed');
  controller.close();
  assert.equal((await iterator.next()).done,true);
});

test('Canva poster requests bypass native image and note generation',()=>{
  const catalog=load('lib/connectors/catalog.ts');
  const intent=load('lib/connectors/intent.ts',{'./catalog':catalog});
  const image=load('lib/assistant/imageIntent.ts',{'@/lib/connectors/intent':intent});
  const note=load('lib/assistant/noteIntent.ts',{'@/lib/connectors/intent':intent});
  assert.equal(image.detectImageIntent('Buatkan poster hemat energi di Canva').isImageRequest,false);
  assert.equal(image.detectImageIntent('Buatkan gambar kucing').isImageRequest,true);
  assert.equal(note.detectNoteIntent('Buat catatan di Notion tentang energi').isNoteRequest,false);
  assert.equal(intent.connectorForPrompt('Buat poster di Canva'),'canva');
});

test('selected connector routes a plain prompt and cannot silently switch apps',async()=>{
  const catalog=load('lib/connectors/catalog.ts');
  const events=[];
  const tools=load('lib/connectors/tools.ts',{'./catalog':catalog,'./productivity':{},'./server':{connectorStates:async()=>[{provider:'notion',permission:'read'},{provider:'canva',permission:'read'}]},'@/lib/supabase/admin':{},
    '@/lib/ai':{aiChatJson:async()=>({provider:'canva',action:'search'})}});
  const result=await tools.connectorChatContext('user','session','Cari materi itu',[],new AbortController().signal,()=>{},call=>events.push(call),'notion');
  assert.equal(events[0].provider,'notion');
  assert.equal(events.at(-1).status,'error');
  assert.match(result,/tidak sesuai konektor/);
});

test('Canva tool updates preserve verified previews and exclude unrelated thumbnail URLs',async()=>{
  const catalog=load('lib/connectors/catalog.ts');
  const {connectorCallSchema}=load('lib/connectors/events.ts');
  const events=[];
  const design={id:'DAabc123',title:'Poster Hemat Energi',thumbnail:{url:'https://media.canva.com/thumbnail.png?signature=test',width:365,height:547},
    urls:{edit_url:'https://www.canva.com/design/DAabc123/edit'}};
  const tools=load('lib/connectors/tools.ts',{'./catalog':catalog,'./productivity':{},
    './server':{connectorStates:async()=>[{provider:'canva',permission:'read'}],providerFetch:async()=>({items:[design,{...design,id:'DAbad',thumbnail:{...design.thumbnail,url:'https://media.canva.com.example.org/fake.png'}}]})},
    '@/lib/supabase/admin':{},'@/lib/ai':{aiChatJson:async()=>({provider:'canva',action:'search',query:'hemat energi',id:''})}});
  await tools.connectorChatContext('user','session','Cari poster di Canva',[],new AbortController().signal,()=>{},call=>events.push(call),'canva');
  assert.deepEqual(events.map(call=>call.status),['running','running','completed']);
  assert.equal(events[0].updates.length,0);
  assert.equal(events[1].updates.length,1);
  const completed=connectorCallSchema.parse(events[2]);
  assert.equal(completed.updates.length,2);
  assert.equal(completed.previews.length,1);
  assert.equal(completed.previews[0].thumbnail.url,design.thumbnail.url);
  assert.equal(completed.links[0].url,design.urls.edit_url);
  assert.equal(connectorCallSchema.parse({...events[0],updates:undefined,previews:undefined}).status,'running');
});
