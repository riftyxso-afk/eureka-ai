const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const home = "https://artificialanalysis.ai/";
const rankings = home + "leaderboards/models";
const text = "Artificial Analysis Intelligence Index. Model Alpha 65. Model Beta 60. These are the observed model rankings.";
const snapshot = url => `Page: Models | Artificial Analysis (${url})\n${text}\nlink href="/leaderboards/models"\nlink href="/models/releases"`;
const compiled = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, "../../lib/study-browser.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function setup(options = {}) {
  const requests = [], activities = [];
  let current = home, reads = 0, plans = 0, menuOpen = false;
  const pageSnapshot = url => options.dropdown && url === home && !menuOpen
    ? `Page: Models | Artificial Analysis (${url})\n${text}\n- button "Leaderboards" [ref=e6]\nlink href="/models#performance"`
    : snapshot(url);
  const api = {};
  const fetcher = async (_, request) => {
    request.signal.throwIfAborted();
    if (request.method === "DELETE") { requests.push({ method: "DELETE" }); return new Response(null, { status: 204 }); }
    const input = JSON.parse(request.body);
    requests.push(input);
    let result = {};
    if (input.method === "tools/list") result = { tools: ["browser_navigate", "browser_read", "browser_tabs", "browser_snapshot", "browser_click"].map(name => ({
      name, inputSchema: { properties: name === "browser_navigate" ? { url: {}, tab: {}, front: {} } : name === "browser_read" ? { tab: {}, offset: {} } : name === "browser_click" ? { tab: {}, ref: {} } : name === "browser_snapshot" ? { tab: {} } : {}, required: name === "browser_navigate" ? ["url"] : name === "browser_click" ? ["ref"] : [] },
    })) };
    if (input.method === "tools/call") {
      const { name, arguments: args } = input.params;
      if (name !== "browser_tabs") assert.equal(args.tab, "STABLE");
      if (name === "browser_tabs") result = { content: [{ type: "text", text: `- tab STABLE "Models" (${home}) [in front]` }] };
      if (name === "browser_navigate") {
        if (!options.oldTab || args.url === home) current = args.url;
        result = options.navigationError || (options.failRanking && args.url === rankings)
          ? { isError: true, content: [{ type: "text", text: "Navigation timed out" }] }
          : { content: [{ type: "text", text: options.empty ? "Loading…" : pageSnapshot(current) }] };
      }
      if (name === "browser_read") {
        reads++;
        if (options.transientRead && reads === 1) return new Response("busy", { status: 503 });
        result = options.readError ? { isError: true } : { content: [{ type: "text", text: options.empty ? "Loading…" : text }] };
      }
      if (name === "browser_click") {
        assert.equal(args.ref, "e6");
        menuOpen = true;
        result = { content: [{ type: "text", text: pageSnapshot(current) }] };
      }
      if (name === "browser_snapshot") result = { content: [{ type: "text", text: options.empty ? "Loading…" : pageSnapshot(current) }] };
    }
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: input.id, result }), { headers: { "content-type": "application/json", "mcp-session-id": "fixture" } });
  };
  const ai = { aiChatJson: async (input, parse) => {
    if (options.planError) throw Error("Planning model unavailable");
    if (options.abortPlan) { options.abortPlan.abort(); options.abortPlan.signal.throwIfAborted(); }
    return parse(JSON.stringify({ url: (options.urls || [])[plans++] || null }));
  } };
  vm.runInNewContext(compiled, { exports: api, require: name => name === "./ai" ? ai : name === "./computer-file-renderer" ? { computerFileRenderer: "" } : require(name),
    process: { env: { BOX_TOKEN: "fixture-key", BOX_OWNER_USER_ID: "owner" } }, fetch: fetcher, URL, AbortSignal, TextDecoder, Buffer,
    console: { warn() {} },
  });
  return { api, requests, activities, run: (prompt = "Cari peringkat model", signal = AbortSignal.timeout(8000)) => api.browseStudy("owner", prompt, signal, event => activities.push(event), { active: { url: home }, history: [] }) };
}

test("navigation timeout recovers the loaded target via snapshot without reloading", async () => {
  const f = setup({ navigationError: true });
  const sources = await f.run("Ringkas halaman ini");
  assert.equal(sources.length, 1);
  assert.equal(sources[0].url, home);
  assert.match(sources[0].excerpt, /Model Alpha 65/);
  assert.equal(f.requests.filter(r => r.params?.name === "browser_navigate").length, 1);
  assert(f.activities.some(a => /memeriksa/.test(a.label)));
  assert.equal(f.requests.at(-1).method, "DELETE");
});

test("failed text reading uses the actual navigation snapshot as evidence", async () => {
  const f = setup({ readError: true });
  const sources = await f.run();
  assert.match(sources[0].excerpt, /Model Alpha 65/);
  assert.equal(sources[0].title, "Models | Artificial Analysis");
});

test("later failed navigation retains prior sources and never attributes an old tab to a new URL", async () => {
  const f = setup({ urls: [rankings, null], failRanking: true, oldTab: true });
  const sources = await f.run();
  assert.deepEqual(sources.map(s => s.url).join(","), home);
  assert(!sources.some(s => s.url === rankings));
  assert(f.activities.some(a => /belum terbaca/.test(a.label)));
});

test("planning failure follows an observed ranking link and stays on the requested website", async () => {
  const f = setup({ planError: true });
  const sources = await f.run();
  assert(sources.some(s => s.url === rankings));
  assert(sources.every(s => new URL(s.url).hostname === "artificialanalysis.ai"));
  assert(!sources.some(s => s.url.includes("releases")));
});

test("ranking navigation opens the observed menu to discover its real leaderboard link", async () => {
  const f = setup({ dropdown: true, planError: true });
  const sources = await f.run();
  assert.equal(f.requests.filter(r => r.params?.name === "browser_click").length, 1);
  assert.equal(sources.at(-1).url, rankings);
  assert(!sources.some(s => s.url.endsWith("#performance")));
});

test("transient MCP read errors retry once without navigating again", async () => {
  const f = setup({ transientRead: true });
  const sources = await f.run("Ringkas halaman ini");
  assert.equal(sources.length, 1);
  assert.equal(f.requests.filter(r => r.params?.name === "browser_read").length, 2);
  assert.equal(f.requests.filter(r => r.params?.name === "browser_navigate").length, 1);
});

test("loading-only pages are not reported as successfully read sources", async () => {
  const f = setup({ empty: true });
  await assert.rejects(f.run(), /isi halaman belum berhasil dibaca/);
  assert(!f.activities.some(a => a.label === "Halaman selesai dibaca"));
  assert.equal(f.requests.at(-1).method, "DELETE");
});

test("user cancellation is never converted into a partial successful response", async () => {
  const controller = new AbortController();
  const f = setup({ abortPlan: controller });
  await assert.rejects(f.run("Cari model", controller.signal));
  assert.equal(f.requests.at(-1).method, "DELETE");
});

test("browser credentials remain account-scoped", async () => {
  const f = setup();
  await assert.rejects(f.api.browseStudy("other-user", "Cari model", AbortSignal.timeout(1000), () => {}), /belum diaktifkan/);
  assert.equal(f.requests.length, 0);
});

test("classification failure still runs Computer Use and streams and saves its answer", async () => {
  const saved = [];
  let browsed = 0;
  const mocks = {
    "@/lib/ai": {
      aiChatJson: async options => {
        if (options.maxTokens === 650) throw Error("Classifier unavailable");
        return { steps: [], suggestions: [] };
      },
      aiChatStream: async (_, emit) => { emit({ type: "token", text: "Observed rankings" }); return { content: "Observed rankings" }; },
    },
    "@/lib/assistant/auth": { requirePro: async () => ({ userId: "owner" }) },
    "@/lib/assistant/store": {
      getSession: async () => ({}), getMessages: async () => [],
      appendMessage: async message => saved.push(message), renameSession: async () => {},
    },
    "@/lib/rateLimit": { ensureRateLimitPrune() {}, checkRateLimit: () => ({ ok: true }) },
    "@/lib/prompts/safety": { AI_SAFETY_GUARDRAIL: "" },
    "@/lib/computer-files": { requestedComputerFormats: () => [] },
    "@/lib/study-browser": {
      hasStudyBrowser: () => true,
      browseStudy: async () => { browsed++; return [{ kind: "web", title: "Rankings", url: rankings, excerpt: text }]; },
    },
    "@/lib/zapi-study": { hasZapi() { assert.fail("Computer Use must not switch to Zapi"); } },
  };
  const route = {};
  const { NextRequest } = require("next/server");
  const source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, "../../app/api/study-agent/route.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports: route, require: name => mocks[name] || (name.startsWith("@/") ? {} : require(name)),
    AbortSignal, AbortController, ReadableStream, TextEncoder, Response, URL, setInterval, clearInterval,
  });
  const response = await route.POST(new NextRequest("http://localhost/api/study-agent", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId: "11111111-1111-4111-8111-111111111111", prompt: "Cari peringkat model", browser: true }),
  }));
  const events = await response.text();
  assert.equal(browsed, 1);
  assert.match(events, /Observed rankings/);
  assert.match(events, /"type":"done"/);
  assert.equal(saved.at(-1).study.browser.url, rankings);
});
