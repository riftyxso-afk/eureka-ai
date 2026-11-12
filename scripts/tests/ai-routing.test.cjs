const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");

function load(fetcher, fastTimers = false) {
  const modules = new Map();
  function read(relative) {
    const filename = path.join(root, relative + ".ts");
    if (modules.has(filename)) return modules.get(filename);
    const module = { exports: {} }; modules.set(filename, module.exports);
    const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const sandbox = {
      exports: module.exports, module,
      require: name => read(path.relative(root, path.resolve(path.dirname(filename), name)).replaceAll("\\", "/")),
      process: { env: { JUANROUTER_API_KEY: "test-only", JUANROUTER_BASE_URL: "https://test.invalid/v1" } },
      console: { log() {}, warn() {}, error() {} },
      fetch: fetcher, AbortController, AbortSignal, DOMException, TextDecoder, Intl,
      setTimeout: fastTimers ? (fn, ms) => setTimeout(fn, ms >= 120_000 ? 800 : 25) : setTimeout,
      clearTimeout,
    };
    vm.runInNewContext(code, sandbox, { filename });
    return module.exports;
  }
  return read;
}
function stream(parts, { broken = false, signal } = {}) {
  return new Response(new ReadableStream({
    start(controller) {
      for (const content of parts) controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`));
      if (broken) controller.enqueue(new TextEncoder().encode('data: {"error":{"message":"upstream failed"}}\n\n'));
      else controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'));
      controller.close();
      signal?.addEventListener("abort", () => {}, { once: true });
    },
  }), { headers: { "content-type": "text/event-stream" } });
}

test("uses exactly three requested models, preserves effort, ignores obsolete selection", async () => {
  const bodies = [];
  const ai = load(async (_, request) => { bodies.push(JSON.parse(request.body)); return stream(["Lima."]); })("lib/ai");
  const ids = ai.getProviderChain("normal", true, true, "gpt-4o").map(p => p.model);
  assert.deepEqual([...ids], ["deepseek-v4-flash", "deepseek-v4.1-flash", "glm-5.3-flash"]);
  for (const speedMode of ["fast", "normal", "deep"]) {
    for (const pro of [false, true]) {
      const chain = ai.getProviderChain(speedMode, pro, true, "gemini-3.8-flash-high");
      assert.equal(chain.some(p => /gemini/i.test(p.model)), false);
      assert.equal(chain.some(p => p.model === "deepseek-v4-flash"), true);
    }
  }
  for (const speedMode of ["fast", "normal", "deep"]) await ai.aiChat({ user: "2+3", speedMode });
  assert.deepEqual(bodies.map(b => b.reasoning_effort), ["low", "medium", "high"]);
});

test("503 skips directly to next model without same-model retry", async () => {
  const models = [];
  const ai = load(async (_, request) => {
    models.push(JSON.parse(request.body).model);
    return models.length === 1 ? new Response("busy", { status: 503 }) : stream(["Jawaban relevan"]);
  })("lib/ai");
  assert.equal(await ai.aiChat({ user: "uji", speedMode: "fast" }), "Jawaban relevan");
  assert.deepEqual(models, ["deepseek-v4.1-flash", "glm-5.3-flash"]);
});

test("slow first token aborts upstream and falls back promptly", async () => {
  let aborted = false; let requests = 0;
  const ai = load(async (_, request) => {
    if (++requests === 1) return new Promise((_, reject) => request.signal.addEventListener("abort", () => { aborted = true; reject(request.signal.reason); }, { once: true }));
    return stream(["Selesai"]);
  }, true)("lib/ai");
  assert.equal(await ai.aiChat({ user: "uji" }), "Selesai");
  assert.equal(aborted, true); assert.equal(requests, 2);
});

test("buffered JSON discards invalid first response and keeps valid fallback", async () => {
  let requests = 0;
  const ai = load(async () => stream([++requests === 1 ? '{"questions":' : '{"questions":[{"answer":0}]}']))("lib/ai");
  const output = await ai.aiChat({ user: "buat kuis", json: true });
  assert.equal(JSON.parse(output).questions[0].answer, 0); assert.equal(requests, 2);
});

test("partial streaming restarts only when its consumer can reset", async () => {
  let requests = 0; let visible = ""; let resets = 0;
  const ai = load(async () => ++requests === 1 ? stream(["Draf lama"], { broken: true }) : stream(["Jawaban baru"]))("lib/ai");
  const result = await ai.aiChatStream({ user: "uji", onReset: () => { visible = ""; resets++; } }, event => { if (event.type === "token") visible += event.text; });
  assert.equal(visible, "Jawaban baru"); assert.equal(result.content, visible); assert.equal(resets, 1);
  requests = 0;
  await assert.rejects(ai.aiChatStream({ user: "uji" }, () => {}));
  assert.equal(requests, 1, "text/audio already shown must never concatenate a second answer");
});

test("caller cancellation never starts another model", async () => {
  const controller = new AbortController(); let requests = 0;
  const ai = load(async (_, request) => {
    requests++; controller.abort(); throw request.signal.reason;
  })("lib/ai");
  await assert.rejects(ai.aiChat({ user: "uji", signal: controller.signal }));
  assert.equal(requests, 1);
});

test("buffered streaming callers can restart without publishing a partial draft", async () => {
  let requests = 0;
  const ai = load(async () => ++requests === 1 ? stream(["Draf terputus"], { broken: true }) : stream(["Naskah lengkap"]))("lib/ai");
  const result = await ai.aiChatStream({ user: "buat naskah" });
  assert.equal(result.content, "Naskah lengkap");
  assert.equal(requests, 2);
});

test("automatic search uses current topics and avoids greetings and private notes", () => {
  const { shouldAutoSearch } = load()("lib/assistant/autoWebSearch");
  for (const text of ["Berita AI hari ini", "Berapa harga emas?", "Siapa presiden Indonesia?", "Cari sumber tentang fotosintesis"]) assert.equal(shouldAutoSearch(text), true, text);
  for (const text of ["Halo!", "2 tambah 3", "Jelaskan fotosintesis sekarang", "Buat kuis hari ini", "Apa isi catatanku?", "Jadwalku besok apa?"]) assert.equal(shouldAutoSearch(text), false, text);
  assert.equal(shouldAutoSearch("Lalu di Bali?", [{ role: "user", content: "Cuaca Jakarta hari ini" }]), true);
});

test("search control markers stay hidden even with trailing whitespace or extra tokens", () => {
  const { holdWebSearchRequest } = load()("lib/assistant/autoWebSearch");
  for (const text of ["[", "[[EUREKA_", "[[EUREKA_WEB_SEARCH]]\n", " [[EUREKA_WEB_SEARCH]]\nsearch"]) assert.equal(holdWebSearchRequest(text), true);
  assert.equal(holdWebSearchRequest("Fotosintesis memerlukan cahaya."), false);
});

test("profile completion reflects saved data and supports non-student accounts", () => {
  const { profileChecklist } = load()("lib/profileChecklist");
  const incomplete = profileChecklist({ name: "Pelajar", username: "", profileData: { education: "sma", grade: "10" } });
  assert.equal(incomplete.filter(x => x.done).length, 1);
  const full = profileChecklist({ name: "Pelajar", username: "pelajar", profileData: { education: "sma", grade: "10", school: "Sekolah", weakTopic: "fisika", learningHabit: "contoh", peakHour: "pagi", psyAnswers: { q1: "visual" } } });
  assert.equal(full.every(x => x.done), true);
  const other = profileChecklist({ name: "Umum", username: "umum", profileData: { education: "lainnya" } });
  assert.equal(other.some(x => x.id === "school"), false);
  assert.equal(other.find(x => x.id === "education").done, true);
});
