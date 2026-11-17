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
      return name.startsWith('.')&&fs.existsSync(source)?load(source,mocks):require(name);
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
    './catalog':load('lib/connectors/catalog.ts'),
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

test('Canva poster starts with real templates and continues using the prior provider cursor', async () => {
  const events = [];
  const queries = [];
  const tools = load('lib/connectors/tools.ts', {
    './productivity': {},
    './server': {
      connectorStates: async () => [{ provider: 'canva', permission: 'read' }],
      providerFetch: async (user, provider, url, body) => {
        assert.equal(user, 'user');
        assert.equal(provider, 'canva');
        assert.equal(body, undefined);
        const request = new URL(url);
        assert.equal(request.pathname, '/rest/v1/brand-templates');
        queries.push(request.searchParams);
        return {
          items: [{
            id: 'DETemplateA', title: 'Poster sekolah',
            create_url: 'https://www.canva.com/design/DATemplate/remix',
            thumbnail: { url: 'https://document-export.canva.com/thumbnail.png', width: 400, height: 600 },
          }],
          continuation: queries.length === 1 ? 'cursor:2' : undefined,
        };
      },
    },
    '@/lib/supabase/admin': { db: () => assert.fail('Searching does not need a write claim') },
    '@/lib/ai': { aiChatJson: async () => ({ provider: 'canva', action: 'create', query: 'sekolah', id: '' }) },
  });
  const run = (prompt, history) => tools.connectorChatContext('user', 'session', prompt, history, new AbortController().signal, () => {}, e => events.push(e));
  const first = await run('Buat poster pakai template Canva untuk sekolah', []);
  assert.match(first, /Poster sekolah/);
  assert.doesNotMatch(first, /cursor:2/);
  const page = events.at(-1);
  assert.equal(page.previews[0].kind, 'brand_template');
  assert.equal(page.previews[0].createUrl, 'https://www.canva.com/design/DATemplate/remix');
  await run('Tampilkan template Canva berikutnya', [{ role: 'assistant', content: 'Berikut template Canva', toolCalls: [page] }]);
  assert.equal(queries[1].get('query'), 'sekolah');
  assert.equal(queries[1].get('continuation'), 'cursor:2');
  assert.equal(events.at(-1).canvaSearch.continuation, undefined);
});

test('Canva checks matching account designs before showing the gallery fallback', async () => {
  const design = {
    id: 'DAExisting', title: 'Poster Biologi',
    thumbnail: { url: 'https://media.canva.com/poster.png', width: 400, height: 600 },
    urls: { edit_url: 'https://www.canva.com/design/DAExisting/edit' },
  };
  for (const items of [[design], []]) {
    const calls = [];
    const paths = [];
    const tools = load('lib/connectors/tools.ts', {
      './productivity': {},
      './server': {
        connectorStates: async () => [{ provider: 'canva', permission: 'read' }],
        providerFetch: async (_, __, url, body) => {
          assert.equal(body, undefined);
          const route = new URL(url);
          paths.push(route.pathname + route.search);
          return { items: route.pathname.endsWith('/designs') ? items : [] };
        },
      },
      '@/lib/supabase/admin': { db: () => assert.fail('Searching must not write') },
      '@/lib/ai': { aiChatJson: async () => ({ provider: 'canva', action: 'create', query: 'biologi', id: '' }) },
    });
    const answer = await tools.connectorChatContext('user', 'session', 'Buat poster biologi pakai template Canva', [],
      new AbortController().signal, () => {}, call => calls.push(call));
    assert.deepEqual(paths, [
      '/rest/v1/brand-templates?limit=3&query=biologi',
      '/rest/v1/brand-templates?limit=3',
      '/rest/v1/designs?query=biologi',
    ]);
    const result = calls.at(-1);
    if (items.length) {
      assert.equal(result.label, 'Desain terkait ditemukan');
      assert.equal(result.previews[0].kind, 'design');
      assert.equal(result.previews[0].id, design.id);
    } else {
      assert.equal(result.label, 'Belum ada template yang cocok');
      assert.equal(result.previews.length, 0);
      assert.equal(result.links[0].url, 'https://www.canva.com/templates/');
      assert.match(answer, /Belum ada poster yang dibuat/);
    }
  }
});

test('Canva autofill uses the live dataset, filters unsupported fields, and polls the job', async () => {
  const requests = [];
  const stages = [];
  const { executeCanva } = load('lib/connectors/canva.ts', {
    'node:timers/promises': { setTimeout: async () => {} },
    '@/lib/ai': { aiChatJson: async (_, parse) => parse(JSON.stringify({ fields: { JUDUL: 'Hemat energi', FOTO: 'wrong type', UNKNOWN: 'omit' } })) },
    './server': { providerFetch: async (_, __, url, body) => {
      const path = new URL(url).pathname;
      requests.push({ path, body });
      if (path.endsWith('/dataset')) return { dataset: { JUDUL: { type: 'text' }, FOTO: { type: 'image' } } };
      if (path.endsWith('/autofills')) return { job: { id: 'job-1', status: 'in_progress' } };
      if (path.endsWith('/autofills/job-1')) return { job: { status: 'success', result: { design: { id: 'DAResult' } } } };
      return {};
    } },
  });
  const result = await executeCanva('user', { action: 'autofill', id: 'DETemplateA', title: 'Poster baru', canvaKind: 'brand_template' },
    'Isi judul template Canva DETemplateA dengan Hemat energi', [], new AbortController().signal, label => stages.push(label));
  assert.equal(result.job.status, 'success');
  assert.equal(requests[1].path, '/rest/v1/brand-templates/DETemplateA/dataset');
  assert.deepEqual(JSON.parse(JSON.stringify(requests[2].body)), {
    type: 'create_from_brand_template', brand_template_id: 'DETemplateA', title: 'Poster baru',
    data: { JUDUL: { type: 'text', text: 'Hemat energi' } },
  });
  assert.equal(requests[3].path, '/rest/v1/autofills/job-1');
  assert.equal(requests[4].path, '/rest/v1/designs/DAResult');
  assert.equal(stages.length, 2);
});

test('Canva edits the original design only with an explicit target and edit instruction', async () => {
  const writes = [];
  const { executeCanva, resolveCanvaPlan } = load('lib/connectors/canva.ts', {
    '@/lib/ai': { aiChatJson: async (_, parse) => parse('{"fields":{"JUDUL":"Judul baru"}}') },
    './server': { providerFetch: async (_, __, url, body) => {
      if (body) { writes.push(body); return { job: { status: 'success' } }; }
      return url.endsWith('/dataset') ? { dataset: { JUDUL: { type: 'text' } } } : {};
    } },
  });
  const plan = { action: 'autofill', id: 'DAExisting', title: '', canvaKind: 'design' };
  const run = prompt => executeCanva('user', plan, prompt, [], new AbortController().signal, () => {});
  assert.equal(resolveCanvaPlan(plan, 'Edit judul desain ini', []).action, 'search');
  await run('Edit judul desain ini');
  assert.equal(writes.length, 0);
  await run('Edit judul desain Canva https://www.canva.com/design/DAExisting/edit');
  assert.equal(writes[0].type, 'update_design');
  assert.equal(writes[0].design_id, 'DAExisting');
  assert.equal(writes[0].title, undefined);
  await run('Buat salinan desain Canva https://www.canva.com/design/DAExisting/edit dengan judul baru');
  assert.equal(writes[1].type, 'create_from_design');
});

test('Gmail creates a draft only after a write grant and a clear request', async () => {
  let permission = 'read';
  let request;
  const calls = [];
  const db = { from: () => ({
    insert: async () => ({}),
    update: () => ({ eq() { return this; } }),
  }) };
  const tools = load('lib/connectors/tools.ts', {
    './productivity': {},
    './server': {
      connectorStates: async () => [{ provider: 'gmail', permission }],
      providerFetch: async (_, __, url, body) => {
        request = { url, raw: Buffer.from(body.message.raw, 'base64url').toString() };
        return { id: 'draft-1' };
      },
    },
    '@/lib/supabase/admin': { db: () => db },
    '@/lib/ai': { aiChatJson: async (_, parse) => parse(JSON.stringify({
      provider: 'gmail', action: 'create', recipient: 'uji@example.com', title: 'Rangkuman', text: 'Halo!',
    })) },
  });
  const run = prompt => tools.connectorChatContext('user', 'session', prompt, [], new AbortController().signal, () => {}, call => calls.push(call), 'gmail');
  await run('Buat draf Gmail untuk uji@example.com');
  assert.equal(calls.at(-1).requiredPermission, 'write');
  assert.equal(request, undefined);
  permission = 'write';
  await run('Jangan buat draf Gmail untuk uji@example.com');
  assert.equal(request, undefined);
  const result = await run('Buat draf Gmail untuk uji@example.com');
  assert.match(result, /draft_saved/);
  assert.match(request.url, /\/drafts$/);
  assert.match(request.raw, /^To: uji@example.com\r\n/);
  assert.equal(calls.at(-1).label, 'Draf tersimpan di Gmail');
});

test('Microsoft and Teams writes use the correct targets and Zotero requires per-item success', async () => {
  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, ...options });
    const result = url.endsWith('/keys/current') ? { userID: '123' }
      : url.includes('/users/123/items') ? { successful: { 0: { key: 'ITEM' } } } : { id: 'created' };
    return { ok: true, json: async () => result };
  };
  try {
    const api = load('lib/connectors/productivity.ts', {
      './server': { accessToken: async (_, __, write) => { assert.equal(write, true); return 'test-token'; } },
    });
    const base = { action: 'create', query: '', id: '', title: 'Catatan', text: 'Isi' };
    await api.productivityTool('user', { ...base, provider: 'onedrive' });
    assert.equal(requests[0].method, 'PUT');
    assert.equal(requests[0].body, 'Isi');
    assert.equal(requests[0].headers['If-None-Match'], '*');
    await api.productivityTool('user', { ...base, provider: 'teams', id: 'team-guid:19:abc@thread.tacv2' });
    assert.match(requests[1].url, /channels\/19%3Aabc%40thread.tacv2\/messages$/);
    assert.deepEqual(JSON.parse(requests[1].body), { body: { contentType: 'text', content: 'Isi' } });
    const reference = await api.productivityTool('user', { ...base, provider: 'zotero', url: 'https://example.com/referensi' });
    assert.equal(reference.key, 'ITEM');
    assert.equal(JSON.parse(requests[3].body)[0].url, 'https://example.com/referensi');
  } finally { globalThis.fetch = original; }
});

test('Canva MCP keeps a pending job and resumes it without another create call', async () => {
  const original = globalThis.fetch;
  const calls = [];
  const saved = [];
  globalThis.fetch = async (_, options) => {
    const rpc = JSON.parse(options.body);
    if (rpc.method === 'initialize') {
      return new Response(JSON.stringify({ id: rpc.id, result: { protocolVersion: '2025-06-18' } }),
        { headers: { 'Mcp-Session-Id': 'test-session' } });
    }
    assert.equal(options.headers['Mcp-Session-Id'], 'test-session');
    if (rpc.method === 'notifications/initialized') return new Response(null, { status: 202 });
    calls.push(rpc.params);
    const payload = rpc.params.name === 'create-design'
      ? { status: 'pending', job_id: 'job-1', continuation_token: 'private-job-token', polling_policy: { wait_seconds: 66 } }
      : { status: 'completed', design: { id: 'DA123', edit_url: 'https://www.canva.com/d/test' } };
    return new Response(JSON.stringify({ id: rpc.id, result: { structuredContent: payload } }));
  };
  try {
    const api = load('lib/connectors/canva-mcp.ts', {
      'node:timers/promises': { setTimeout: async () => {} },
      './server': {
        accessToken: async (_, __, write) => { assert.equal(write, true); return 'test-token'; },
        seal: value => Buffer.from(JSON.stringify(value)).toString('base64'),
        unseal: value => JSON.parse(Buffer.from(value, 'base64').toString()),
      },
    });
    const input = { userId: 'user', sessionId: 'session', brief: 'Buat poster di Canva', title: 'Poster',
      signal: new AbortController().signal, progress: () => {}, savePending: async result => saved.push(result) };
    assert.equal(api.wantsNewCanvaDesign('Buat poster di Canva, gunakan warna hijau.'), true);
    assert.equal(api.wantsNewCanvaDesign('Buat poster pakai template Canva.'), false);
    const pending = await api.generateCanvaDesign(input);
    assert.equal(pending.job.status, 'in_progress');
    const job = JSON.parse(Buffer.from(pending.canvaResume.state, 'base64').toString());
    const resume = { ...pending.canvaResume, state: Buffer.from(JSON.stringify({ ...job, pollAfter: 0 })).toString('base64') };
    await assert.rejects(api.generateCanvaDesign({ ...input, sessionId: 'other', resume }), /percakapan lain/);
    const completed = await api.generateCanvaDesign({ ...input, resume });
    assert.equal(completed.design.urls.edit_url, 'https://www.canva.com/d/test');
    assert.deepEqual(calls.map(item => item.name), ['create-design', 'get-create-design-async-job']);
    assert.equal(calls[0].arguments.brief, input.brief);
    assert.equal(calls[1].arguments.continuation_token, 'private-job-token');
  } finally { globalThis.fetch = original; }
});
