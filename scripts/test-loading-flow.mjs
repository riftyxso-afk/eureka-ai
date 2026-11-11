import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, dependencies, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    exports, AbortController, Response, Headers, TextDecoder, console,
    setTimeout: (...args) => { const timer = setTimeout(...args); timer.unref(); return timer; },
    clearTimeout,
    require: name => name in dependencies ? dependencies[name] : require(name),
    ...globals,
  }, { filename: file });
  return exports;
}

const tick = () => new Promise(resolve => setTimeout(resolve, 5));
const free = { isPremium: false, tier: null, premiumUntil: null };
const pro = { isPremium: true, tier: "normal", premiumUntil: null };

function premiumStore(initialUser = "alice") {
  let userId = initialUser;
  let authCallback;
  let getSnapshot;
  let authSyncs = 0;
  const requests = [];
  const listeners = new Map();
  const subscriptions = [];
  const api = load("lib/usePremium.ts", {
    "./free-pro-period": { FREE_PRO_START: "2026-01-01T00:00:00.000Z" },
    react: { useSyncExternalStore(subscribe, snapshot) {
      getSnapshot = snapshot;
      subscriptions.push(subscribe(() => {}));
      return snapshot();
    } },
    "./apiClient": { apiFetch: (url, options) => new Promise(resolve => {
      requests.push({ url, signal: options.signal, reply: (data, status = 200) => resolve(Response.json(data, { status })) });
    }) },
    "./identity": { getUserId: () => userId },
    "./auth": { syncAuthSession: async () => { authSyncs++; }, isLoggedIn: () => Boolean(userId) },
    "./supabase/client": { supabase: { auth: { onAuthStateChange(callback) { authCallback = callback; } } } },
  }, { window: { addEventListener(name, callback) {
    const group = listeners.get(name) ?? new Set(); group.add(callback); listeners.set(name, group);
  } } });
  return {
    mount: () => api.usePremium(),
    unmountAll: () => subscriptions.splice(0).forEach(unsubscribe => unsubscribe()),
    snapshot: () => getSnapshot(),
    requests, listeners,
    authSyncs: () => authSyncs,
    auth(event, nextUser = userId) { userId = nextUser; authCallback(event, nextUser ? { user: { id: nextUser } } : null); },
    update() { for (const callback of listeners.get(api.PREMIUM_UPDATED_EVENT) ?? []) void callback(); },
  };
}

test("plan status uses one request across components, remounts, and repeated sign-in notifications", async () => {
  const store = premiumStore();
  for (let i = 0; i < 10; i++) store.mount();
  await tick();
  assert.equal(store.requests.length, 1);
  assert.equal(store.authSyncs(), 1);
  assert.equal(store.listeners.get("eureka-premium-updated").size, 1);
  assert.equal(store.snapshot().loading, true);
  store.requests[0].reply(pro);
  await tick();
  store.unmountAll();
  assert.equal(store.mount().isPremium, true);
  store.auth("SIGNED_IN");
  await tick();
  assert.equal(store.requests.length, 1);
  assert.equal(store.snapshot().loading, false);
  store.update(); store.update();
  await tick();
  assert.equal(store.requests.length, 2);
  assert.equal(store.snapshot().loading, false, "background refresh must not flash a full-page loader");
  store.requests[1].reply(free);
  await tick();
  assert.equal(store.snapshot().isPremium, false);
});

test("account changes discard pending Pro responses and queued callbacks cannot undo sign-out", async () => {
  const store = premiumStore();
  store.mount(); await tick();
  store.auth("SIGNED_IN", "bob"); await tick();
  assert.equal(store.requests.length, 2);
  assert.equal(store.requests[0].signal.aborted, true);
  assert.ok(store.requests[1].url.endsWith("userId=bob"));
  store.requests[1].reply(free); await tick();
  store.requests[0].reply(pro); await tick();
  assert.equal(store.snapshot().isPremium, false);
  store.auth("SIGNED_IN", "alice");
  store.auth("SIGNED_OUT", null);
  await tick();
  assert.equal(store.requests.length, 2, "obsolete queued sign-in must not re-fetch the old account");
  assert.equal(store.snapshot().isPremium, false);
  assert.equal(store.snapshot().loading, false);
});

test("plan failures expose a retry and a successful retry replaces the error", async () => {
  const store = premiumStore();
  const { refresh } = store.mount(); await tick();
  store.requests[0].reply({ error: "Unavailable" }, 503); await tick();
  assert.equal(store.snapshot().loading, false);
  assert.ok(store.snapshot().error);
  const retry = refresh(); await tick();
  assert.equal(store.snapshot().loading, true);
  store.requests[1].reply(pro); await retry;
  assert.equal(store.snapshot().isPremium, true);
  assert.equal(store.snapshot().error, null);
});

test("the cached plan revalidates automatically when its verified expiry is reached", async () => {
  const store = premiumStore();
  store.mount(); await tick();
  store.requests[0].reply({ ...pro, premiumUntil: new Date(Date.now() + 20).toISOString() });
  await new Promise(resolve => setTimeout(resolve, 45));
  assert.equal(store.requests.length, 2);
  store.requests[1].reply(free); await tick();
  assert.equal(store.snapshot().isPremium, false);
});

test("persisted note jobs retain phase and ownership on a different server instance", async () => {
  const rows = new Map();
  const dependencies = { "@/lib/supabase/admin": { db: () => ({ from: () => ({
    async upsert(row) { rows.set(row.id, structuredClone({ created_at: new Date().toISOString(), ...row })); return { error: null }; },
    select() { return { eq(_key, id) { return { maybeSingle: async () => ({ data: rows.get(id) }) }; } }; },
  }) }) } };
  const producer = load("lib/jobQueue.ts", dependencies);
  const id = producer.createJob({ userId: "alice", sessionId: "session", run: async () => {} });
  await producer.updateJob(id, { phase: "enrichment", percent: 60, message: "Mencari sumber" });
  const consumer = load("lib/jobQueue.ts", dependencies);
  const restored = await consumer.getJob(id);
  assert.equal(restored.userId, "alice");
  assert.equal(restored.phase, "enrichment");
  assert.equal(restored.percent, 60);
  assert.equal(restored.status, "running");
});

test("note labels use the actual pipeline phase and support legacy persisted messages", () => {
  const { noteLoadingStage, isLoadingStage } = load("lib/loading-stage.ts", {});
  for (const [phase, expected] of Object.entries({ extract: "reading", chapters: "thinking", enrichment: "retrieving", rag: "synchronizing", study_tools: "combining" })) {
    assert.equal(noteLoadingStage(phase), expected);
  }
  assert.equal(noteLoadingStage(undefined, "Menyimpan hasil"), "synchronizing");
  assert.equal(noteLoadingStage(undefined, "Membaca dokumen"), "reading");
  assert.equal(isLoadingStage("unknown"), false);
});

test("fragmented SSE delivers activity changes, Unicode tokens, and completion in order", async () => {
  const events = [
    { type: "activity", stage: "reading" },
    { type: "activity", stage: "retrieving" },
    { type: "activity", stage: "thinking" },
    { type: "activity", stage: "combining" },
    { type: "token", text: "Catatan siap ✓" },
    { type: "done" },
  ];
  const bytes = new TextEncoder().encode(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(""));
  const stream = new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
    controller.close();
  } });
  const client = load("lib/assistant-stream.ts", {
    "@/lib/apiClient": { apiUrl: path => path },
    "@/lib/supabase/client": { getAccessToken: async () => null },
    "@/lib/sound/cuelume": { playCompletionSound() {} },
  }, { fetch: async () => new Response(stream, { headers: { "Content-Type": "text/event-stream" } }) });
  const received = [];
  const { completed } = await client.streamAssistantChat({ sessionId: "session", userId: "alice", question: "Bantu belajar" }, event => received.push(JSON.parse(JSON.stringify(event))));
  await completed;
  assert.deepEqual(received, events);
});
