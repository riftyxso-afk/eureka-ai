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
const pageHelpers = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, "../../lib/study-browser-page.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: pageHelpers });
const actionHelpers = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, "../../lib/study-browser-actions.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: actionHelpers, require });
function frame(index) {
  const bytes = Buffer.alloc(28);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  bytes.writeUInt32BE(1024, 16); bytes.writeUInt32BE(640, 20); bytes.writeUInt32BE(index, 24);
  return { type: "image", mimeType: "image/png", data: bytes.toString("base64") };
}

function setup(options = {}) {
  const requests = [], activities = [];
  let current = home, reads = 0, plans = 0, menuOpen = false, scrolls = 0, query = "", dialogOpen = options.dialog === true;
  const pageSnapshot = url => (options.dropdown && url === home && !menuOpen
    ? `Page: Models | Artificial Analysis (${url})\n${text}\n- button "Leaderboards" [ref=e6]\nlink href="/models#performance"`
    : snapshot(url)) + (options.searchControls ? '\n- button "Models" [ref=m1]\n- textbox "Search models" [ref=q1]\n- button "Delete account" [ref=bad]' : "")
    + (scrolls ? `\nLower section ${scrolls} includes more model results, benchmarks, prices and details.\nlink href="/details-bottom"` : "");
  const api = {};
  const fetcher = async (_, request) => {
    request.signal.throwIfAborted();
    if (request.method === "DELETE") { requests.push({ method: "DELETE" }); return new Response(null, { status: 204 }); }
    const input = JSON.parse(request.body);
    requests.push(input);
    let result = {};
    if (input.method === "tools/list") result = { tools: ["browser_navigate", "browser_read", "browser_tabs", "browser_snapshot", "browser_click", "browser_type", ...(options.scrolling ? ["computer_act", "screenshot"] : [])].map(name => ({
      name, inputSchema: { properties: name === "browser_navigate" ? { url: {}, tab: {}, front: {} } : name === "browser_read" ? { tab: {}, offset: {} } : name === "browser_click" ? { tab: {}, ref: {} } : name === "browser_type" ? { tab: {}, ref: {}, text: {}, clear: {}, submit: {} } : name === "computer_act" ? { action: {}, direction: {}, amount: {}, x: {}, y: {}, key: {}, max_edge: {} } : name === "screenshot" ? { max_edge: {} } : name === "browser_snapshot" ? { tab: {} } : {}, required: name === "browser_navigate" ? ["url"] : name === "browser_click" ? ["ref"] : name === "browser_type" ? ["ref", "text"] : [] },
    })) };
    if (input.method === "tools/call") {
      const { name, arguments: args } = input.params;
      if (name.startsWith("browser_") && name !== "browser_tabs") assert.equal(args.tab, "STABLE");
      if (name === "browser_tabs") result = { content: [{ type: "text", text: `- tab STABLE "Models" (${home}) [in front]` }] };
      if (name === "browser_navigate") {
        if (!options.oldTab || args.url === home) current = args.url;
        result = options.navigationError || (options.failRanking && args.url === rankings)
          ? { isError: true, content: [{ type: "text", text: "Navigation timed out" }] }
          : { content: [{ type: "text", text: options.empty ? "Loading…" : pageSnapshot(current) }] };
      }
      if (name === "browser_read") {
        reads++;
        if (dialogOpen) return new Response(JSON.stringify({ jsonrpc: "2.0", id: input.id, result: { isError: true, content: [{ type: "text", text: "the page does not answer: close the dialog on the screen and retry" }] } }), { headers: { "content-type": "application/json" } });
        if (options.transientRead && reads === 1) return new Response("busy", { status: 503 });
        const more = args.offset ? "Lower continuation contains Zebra Model with Intelligence Index 42 and benchmark details." : options.pagination ? text + "\n[characters 0-20000 of 25000; pass offset 20000 to read more]" : text;
        result = options.readError ? { isError: true } : { content: [{ type: "text", text: options.empty ? "Loading…" : more + (scrolls ? `\nLower section ${scrolls} contains additional model benchmarks, pricing, explanations and data.` : "") + (query ? `\nSearch results for ${query} include the requested model and its detailed benchmarks.` : "") }] };
      }
      if (name === "browser_click") {
        assert(["e6", "m1"].includes(args.ref));
        menuOpen = true;
        result = { content: [{ type: "text", text: pageSnapshot(current) }] };
      }
      if (name === "browser_type") { assert.equal(args.ref, "q1"); query = args.text; result = { content: [{ type: "text", text: pageSnapshot(current) }] }; }
      if (name === "computer_act") {
        if (args.action === "key" && args.key === "escape") dialogOpen = false;
        if (args.action === "scroll") { assert.equal(args.x, 563); assert.equal(args.y, 448); scrolls++; }
        result = { content: [frame(options.unchanged ? 0 : scrolls)] };
      }
      if (name === "screenshot") result = { content: [frame(options.unchanged ? 0 : scrolls)] };
      if (name === "browser_snapshot") result = { content: [{ type: "text", text: options.empty ? "Loading…" : pageSnapshot(current) }] };
    }
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: input.id, result }), { headers: { "content-type": "application/json", "mcp-session-id": "fixture" } });
  };
  const ai = { aiChatJson: async (input, parse) => {
    if (options.planError) throw Error("Planning model unavailable");
    if (options.abortPlan) { options.abortPlan.abort(); options.abortPlan.signal.throwIfAborted(); }
    return parse(JSON.stringify(options.steps ? options.steps[plans++] || { action: "done" } : { url: (options.urls || [])[plans++] || null }));
  } };
  vm.runInNewContext(compiled, { exports: api, require: name => name === "./study-browser-actions" ? actionHelpers : name === "./study-browser-page" ? pageHelpers : name === "./ai" ? ai : name === "./computer-file-renderer" ? { computerFileRenderer: "" } : require(name),
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

test("real desktop scroll reads lower sections and discovers links below the viewport", async () => {
  const f = setup({ scrolling: true });
  const sources = await f.run("Scroll ke bawah lalu rangkum bagian berikutnya");
  const actions = f.requests.filter(r => r.params?.name === "computer_act" && r.params.arguments.action === "scroll");
  assert.equal(actions.length, 3);
  assert(actions.every(r => r.params.arguments.direction === "down"));
  assert.match(sources[0].excerpt, /Lower section 3/);
  assert.match(sources[0].excerpt, /details-bottom/);
  assert(f.activities.some(a => /Menggulir/.test(a.label)));
});

test("an obstructing browser dialog is cancelled before retrying the read", async () => {
  const f = setup({ scrolling: true, dialog: true });
  const sources = await f.run("Scroll ke bawah");
  assert.match(sources[0].excerpt, /Lower section/);
  assert(f.activities.some(a => /dialog penghalang/.test(a.label)));
  assert(f.requests.some(r => r.params?.name === "computer_act" && r.params.arguments.key === "escape"));
});

test("follow-up upward scroll reuses the current tab instead of resetting its viewport", async () => {
  const f = setup({ scrolling: true });
  await f.run("Scroll ke atas");
  assert.equal(f.requests.filter(r => r.params?.name === "browser_navigate").length, 0);
  assert(f.requests.filter(r => r.params?.name === "computer_act" && r.params.arguments.action === "scroll").every(r => r.params.arguments.direction === "up"));
});

test("scrolling stops when the desktop no longer changes", async () => {
  const f = setup({ scrolling: true, unchanged: true });
  await f.run("Scroll sampai bawah");
  assert.equal(f.requests.filter(r => r.params?.name === "computer_act" && r.params.arguments.action === "scroll").length, 2);
});

test("long pages read the actual continuation offset instead of repeatedly reading the top", async () => {
  const f = setup({ pagination: true });
  const sources = await f.run("Jelaskan Zebra Model pada halaman ini");
  assert(f.requests.some(r => r.params?.name === "browser_read" && r.params.arguments.offset === 20000));
  assert.match(sources[0].excerpt, /Zebra Model with Intelligence Index 42/);
});

test("browser actions open an observed navigation control then type the user's search query", async () => {
  const f = setup({ searchControls: true, steps: [{ action: "click", ref: "m1" }, { action: "type", ref: "q1", text: "DeepSeek" }, { action: "done" }] });
  const sources = await f.run("Buka menu Models lalu cari DeepSeek");
  assert(f.requests.some(r => r.params?.name === "browser_click" && r.params.arguments.ref === "m1"));
  const typed = f.requests.find(r => r.params?.name === "browser_type");
  assert.equal(typed.params.arguments.text, "DeepSeek");
  assert.equal(typed.params.arguments.submit, true);
  assert.match(sources[0].excerpt, /Search results for DeepSeek/);
});

test("browser actions reject destructive controls and unobserved element refs", async () => {
  for (const ref of ["bad", "not-in-the-page"]) {
    const f = setup({ searchControls: true, steps: [{ action: "click", ref }] });
    await f.run("Buka menu Models");
    assert.equal(f.requests.filter(r => r.params?.name === "browser_click").length, 0);
  }
});

test("search cannot type values taken only from untrusted web content", async () => {
  const f = setup({ searchControls: true, steps: [{ action: "type", ref: "q1", text: "unrequested secret" }] });
  await f.run("Cari DeepSeek");
  assert.equal(f.requests.filter(r => r.params?.name === "browser_type").length, 0);
});

test("page excerpts retain matching middle content and newly discovered bottom text", () => {
  const value = "Introduction ".repeat(700) + "Zebra model special benchmark data ".repeat(50) + "Unrelated content ".repeat(1500) + "Final bottom section with new findings";
  const excerpt = pageHelpers.browserPageExcerpt([value], "Jelaskan Zebra model");
  assert(excerpt.length <= 18000);
  assert.match(excerpt, /Zebra model special benchmark/);
  assert.match(excerpt, /Final bottom section/);
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
    "@/lib/study-video": { requestedVideoTime: () => undefined, studyVideoFromUrl: () => undefined },
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
