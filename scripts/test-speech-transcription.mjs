// Offline regression checks. Run: node --test scripts/test-speech-transcription.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, dependencies, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, require: name => name in dependencies ? dependencies[name] : require(name),
    Blob, FormData, Response, AbortSignal, console, process: { env: {} }, ...globals,
  }, { filename: file });
  return exports;
}

test("ElevenLabs receives the real audio and STT settings, including Safari M4A", async () => {
  let called = false;
  const { transcribeRecording } = load("lib/audio/transcribe.ts", {}, {
    process: { env: { ELEVENLABS_API_KEY: "test-only" } },
    fetch: async (url, options) => {
      called = true;
      assert.equal(url, "https://api.elevenlabs.io/v1/speech-to-text");
      assert.equal(options.headers["xi-api-key"], "test-only");
      assert.equal(options.body.get("model_id"), "scribe_v2");
      assert.equal(options.body.get("file").name, "rekaman.m4a");
      assert.equal(await options.body.get("file").text(), "recorded bytes");
      return Response.json({ text: "  Jelaskan hukum Newton.  " });
    },
  });
  assert.equal(await transcribeRecording(new Blob(["recorded bytes"], { type: "audio/mp4" }), "rekaman.m4a"), "Jelaskan hukum Newton.");
  assert.ok(called);
});

test("Empty speech, quota errors and missing credentials produce useful errors", async () => {
  for (const [status, body, expected] of [[200, { text: " " }, 422], [429, {}, 429], [401, {}, 502]]) {
    const mod = load("lib/audio/transcribe.ts", {}, {
      process: { env: { ELEVENLABS_API_KEY: "test-only" } }, fetch: async () => Response.json(body, { status }),
    });
    await assert.rejects(() => mod.transcribeRecording(new Blob(["audio"]), "a.webm"), error => error.status === expected);
  }
  const mod = load("lib/audio/transcribe.ts", {});
  await assert.rejects(() => mod.transcribeRecording(new Blob(["a"]), "a.webm"), error => error.status === 503);
});

function route({ auth = { userId: "ordinary-user" }, limited = false } = {}) {
  let calls = 0;
  const provider = load("lib/audio/transcribe.ts", {});
  const { POST } = load("app/api/audio/transcribe/route.ts", {
    "@/lib/assistant/auth": { authorizeAssistantUser: async () => auth },
    "@/lib/audio/transcribe": { ...provider, transcribeRecording: async () => { calls++; return "Halo Momo"; } },
    "@/lib/rateLimit": { ensureRateLimitPrune() {}, checkRateLimit: () => ({ ok: !limited }) },
  });
  return { POST, calls: () => calls };
}
function request(audio = new Blob(["audio"], { type: "audio/webm" })) {
  const form = new FormData();
  form.set("userId", "ordinary-user");
  if (audio) form.set("audio", audio, "rekaman.webm");
  return new Request("http://localhost/api/audio/transcribe", { method: "POST", body: form });
}

test("An ordinary signed-in account can transcribe without a beta or Pro flag", async () => {
  const handler = route();
  const result = await handler.POST(request());
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { ok: true, text: "Halo Momo" });
  assert.equal(handler.calls(), 1);
});

test("Unauthenticated users and rate-limited requests never reach the provider", async () => {
  for (const [options, expected] of [[{ auth: { userId: "", status: 401, error: "Masuk ulang" } }, 401], [{ limited: true }, 429]]) {
    const handler = route(options);
    assert.equal((await handler.POST(request())).status, expected);
    assert.equal(handler.calls(), 0);
  }
});

test("Invalid, empty and oversized uploads are rejected before provider calls", async () => {
  for (const [audio, expected] of [[null, 400], [new Blob([], { type: "audio/webm" }), 400], [new Blob(["text"], { type: "text/plain" }), 400], [new Blob([new Uint8Array(8 * 1024 * 1024 + 1)], { type: "audio/webm" }), 413]]) {
    const handler = route();
    assert.equal((await handler.POST(request(audio))).status, expected);
    assert.equal(handler.calls(), 0);
  }
});
