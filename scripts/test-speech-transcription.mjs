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
    exports, require: name => name in dependencies ? dependencies[name] : name === "./elevenlabs" ? load("lib/audio/elevenlabs.ts", {}, globals) : require(name),
    Blob, FormData, Headers, Response, ReadableStream, TextDecoder, TextEncoder, AbortController, AbortSignal, console, process: { env: {} }, ...globals,
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
      assert.equal(options.headers.get("xi-api-key"), "test-only");
      assert.equal(options.body.get("model_id"), "scribe_v2");
      assert.equal(options.body.get("language_code"), "id");
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

test("ElevenLabs retries quota failures with the second key and preserves the request body", async () => {
  for (const status of [400, 401, 402, 429]) {
    const used = [];
    const audio = new FormData();
    audio.append("file", new Blob(["speech"]), "test.webm");
    const helper = load("lib/audio/elevenlabs.ts", {}, {
      process: { env: { ELEVENLABS_API_KEY: "primary", ELEVENLABS_API_KEY_FALLBACK: "backup" } },
      fetch: async (_url, options) => {
        used.push(options.headers.get("xi-api-key"));
        assert.equal(options.body, audio);
        return used.length === 1 ? Response.json({ detail: { status: "quota_exceeded" } }, { status }) : Response.json({ text: "Halo" });
      },
    });
    const result = await helper.elevenLabsFetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", body: audio });
    assert.equal(result.status, 200);
    assert.deepEqual(used, ["primary", "backup"]);
  }
});

test("ElevenLabs does not retry success, invalid keys, permissions or validation errors", async () => {
  for (const status of [200, 400, 401, 403, 404]) {
    let calls = 0;
    const helper = load("lib/audio/elevenlabs.ts", {}, {
      process: { env: { ELEVENLABS_API_KEY: "primary", ELEVENLABS_API_KEY_FALLBACK: "backup" } },
      fetch: async () => { calls++; return Response.json({ detail: { status: "invalid_api_key" } }, { status }); },
    });
    assert.equal((await helper.elevenLabsFetch("https://api.elevenlabs.io/v1/voices")).status, status);
    assert.equal(calls, 1);
  }
});

function route({ auth = { userId: "ordinary-user" }, limited = false } = {}) {
  let calls = 0;
  let language;
  const provider = load("lib/audio/transcribe.ts", {});
  const { POST } = load("app/api/audio/transcribe/route.ts", {
    "@/lib/assistant/auth": { authorizeAssistantUser: async () => auth },
    "@/lib/audio/transcribe": { ...provider, transcribeRecording: async (_audio, _filename, selectedLanguage) => {
      calls++;
      language = selectedLanguage;
      return "Halo Momo";
    } },
    "@/lib/rateLimit": { ensureRateLimitPrune() {}, checkRateLimit: () => ({ ok: !limited }) },
  });
  return { POST, calls: () => calls, language: () => language };
}
function request(audio = new Blob(["audio"], { type: "audio/webm" }), locale) {
  const form = new FormData();
  form.set("userId", "ordinary-user");
  if (audio) form.set("audio", audio, "rekaman.webm");
  return new Request("http://localhost/api/audio/transcribe", {
    method: "POST", body: form, headers: locale ? { "x-locale": locale } : undefined,
  });
}

test("An ordinary signed-in account can transcribe without a beta or Pro flag", async () => {
  const handler = route();
  const result = await handler.POST(request());
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { ok: true, text: "Halo Momo" });
  assert.equal(handler.calls(), 1);
  assert.equal(handler.language(), "id");
});

test("Dictation uses the Eureka language with Indonesian as its default", async () => {
  for (const [locale, expected] of [["id", "id"], ["en", "en"], ["unknown", "id"]]) {
    const handler = route();
    assert.equal((await handler.POST(request(undefined, locale))).status, 200);
    assert.equal(handler.language(), expected);
  }
});

test("Realtime calls recover a granted microphone, greet once, and allow corrections without echo", async () => {
  const audioNode = { connect() {}, disconnect() {} };
  let socket, worklet, source, playback;
  let now = 1000;
  let answers = 0;
  const micRequests = [];
  const track = { readyState: "live", stop() {} };
  const spoken = [];
  const { useMomoCall } = load("components/assistant/useMomoCall.ts", {
    react: {
      useState: value => [value, () => {}],
      useRef: current => ({ current }),
      useEffect() {},
      useCallback: callback => callback,
    },
    "@/lib/apiClient": {
      getClientLocale: () => "id",
      async apiFetch(path, init) {
        if (path === "/api/call/session") return Response.json({ token: "test-only" });
        if (path === "/api/call") { answers++; return Response.json({ reply: "Halo!" }); }
        spoken.push(JSON.parse(init.body).text);
        return new Response(new Uint8Array(9600));
      },
    },
    "@/lib/identity": { getUserId: () => "ordinary-user" },
    "./recordCallTurns": {},
    "./lalaWorkspace": {},
    "@/lib/audio/callReply": load("lib/audio/callReply.ts", {}),
  }, {
    navigator: {
      permissions: { query: async () => ({ state: "granted" }) },
      mediaDevices: { getUserMedia: async constraints => {
        micRequests.push(constraints.audio);
        if (micRequests.length === 1) throw { name: "NotAllowedError" };
        return { getTracks: () => [track], getAudioTracks: () => [track] };
      } },
    },
    performance: { now: () => now },
    URLSearchParams, btoa,
    window: { setTimeout: () => 1, clearTimeout() {}, AudioContext: class {
      state = "running";
      currentTime = 0;
      audioWorklet = { addModule: async () => {} };
      resume = async () => {};
      close = async () => {};
      createAnalyser = () => ({ ...audioNode });
      createMediaStreamSource = () => audioNode;
      createBuffer = (_channels, frames, rate) => ({ duration: frames / rate, getChannelData: () => new Float32Array(frames) });
      createBufferSource = () => (source = {
        ...audioNode, start() {}, stop() {}, addEventListener: (_event, done) => { playback = done; },
      });
    } },
    AudioWorkletNode: class {
      port = { close() {} };
      connect() {}
      disconnect() {}
      constructor() { worklet = this; }
    },
    WebSocket: class {
      static OPEN = 1;
      readyState = 1;
      bufferedAmount = 0;
      sent = [];
      constructor(url) { this.url = new URL(url); socket = this; }
      send(chunk) { this.sent.push(JSON.parse(chunk)); }
      close() {}
    },
  });
  const call = useMomoCall();
  const message = (message_type, text) => socket.onmessage({ data: JSON.stringify({ message_type, text }) });
  const chunk = (amplitude = 1) => {
    worklet.port.onmessage({ data: new Uint8Array(3200).fill(amplitude).buffer });
    return socket.sent.at(-1).audio_base_64;
  };
  try {
    await call.start();
    assert.equal(micRequests[0].echoCancellation, true);
    assert.equal(micRequests[1], true);
    assert.equal(micRequests.length, 2);
    assert.equal(socket.url.searchParams.get("language_code"), "id");
    message("session_started");
    message("session_started");
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(playback);
    assert.deepEqual(spoken, ["Hai, aku Momo. Ada yang bisa aku bantu?"]);
    const silence = btoa("\0".repeat(3200));
    assert.equal(chunk(), silence);
    message("committed_transcript", "Gema dari speaker");
    assert.equal(answers, 0);
    chunk(16);
    assert.notEqual(chunk(16), silence);
    message("partial_transcript", "Hai, aku Momo.");
    assert.equal(chunk(), btoa("\x01".repeat(3200)));
    message("partial_transcript", "Eh, salah");
    message("committed_transcript", "Eh, salah.");
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(spoken, ["Hai, aku Momo. Ada yang bisa aku bantu?", "Oh, maksudmu apa tadi?"]);
    assert.equal(answers, 0);
    source.onended();
    playback();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(chunk(), silence);
    now += 200;
    const liveAudio = chunk();
    assert.notEqual(liveAudio, silence);
    message("partial_transcript", "Maksudku energi");
    message("committed_transcript", "Maksudku energi");
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(answers, 1);
    source.onended();
    playback();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(chunk(), silence);
    now += 200;
    assert.equal(chunk(), liveAudio);
    call.toggleMute();
    assert.equal(chunk(), silence);
  } finally {
    call.stop();
  }
});

test("Lala only issues a model-bound single-use token to authenticated callers", async () => {
  let upstream = 0;
  const dependencies = {
    "@/lib/audio/elevenlabs": { hasElevenLabsKey: () => false },
    "@/lib/assistant/auth": {
      requireAuth: async authorization => authorization ? { userId: "ordinary-user" } : { status: 401 },
    },
    "@/lib/rateLimit": { ensureRateLimitPrune() {}, checkRateLimit: () => ({ ok: true }) },
    "@/lib/prompts/safety": { AI_SAFETY_GUARDRAIL: "Safety policy" },
  };
  const request = (signedIn = true) => new Request("https://eureka.example/api/call/session", {
    method: "POST",
    headers: signedIn ? { authorization: "Bearer test" } : {},
    body: JSON.stringify({ provider: "lala", language: "id" }),
  });
  const disabled = load("app/api/call/session/route.ts", dependencies);
  assert.deepEqual(await disabled.GET().json(), { lala: false });
  assert.equal((await disabled.POST(request())).status, 503);
  const enabled = load("app/api/call/session/route.ts", dependencies, {
    process: { env: { GEMINI_API_KEY: "server-secret" } },
    fetch: async (url, options) => {
      upstream++;
      assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/auth_tokens");
      assert.equal(options.headers["x-goog-api-key"], "server-secret");
      const body = JSON.parse(options.body);
      assert.equal(body.uses, 1);
      assert.equal(body.bidiGenerateContentSetup.model, "models/gemini-3.8-live");
      assert.deepEqual(body.bidiGenerateContentSetup.generationConfig.responseModalities, ["AUDIO"]);
      assert.equal(body.bidiGenerateContentSetup.tools[0].functionDeclarations[0].name, "search_call_web");
      assert.match(body.bidiGenerateContentSetup.systemInstruction.parts[0].text, /Lala.*bahasa Indonesia/);
      return Response.json({ name: "auth_tokens/test" });
    },
  });
  assert.equal((await enabled.POST(request(false))).status, 401);
  assert.equal(upstream, 0);
  const result = await enabled.POST(request());
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.deepEqual(await result.json(), { token: "auth_tokens/test", model: "models/gemini-3.8-live" });
  assert.equal(upstream, 1);
});

test("Lala cannot delete ambiguous notes or skip the user's confirmation", async () => {
  const note = { id: "note-1", title: "Fotosintesis" };
  let notes = [note, { id: "note-2", title: "Fotosintesis" }];
  const deletions = [];
  const { runLalaWorkspace } = load("components/assistant/lalaWorkspace.ts", {
    "@/lib/identity": { getUserId: () => "ordinary-user" },
    "@/lib/apiClient": { apiFetch: async (path, options) => {
      if (options.method === "DELETE") deletions.push(path);
      return Response.json(path.includes("?") ? { notes } : { note });
    } },
  }, { window: { dispatchEvent() {} }, Event });
  const args = { action: "delete", title: "Fotosintesis" };
  const signal = new AbortController().signal;
  const result = await runLalaWorkspace(args, signal, () => assert.fail("Ambiguous title"), () => {});
  assert.match(result.error, /beberapa catatan/);
  notes = [note];
  await runLalaWorkspace(args, signal, async () => false, () => {});
  assert.deepEqual(deletions, []);
  await runLalaWorkspace(args, signal, async title => {
    assert.equal(title, note.title);
    assert.deepEqual(deletions, []);
    return true;
  }, () => {});
  assert.deepEqual(deletions, ["/api/notes/note-1"]);
});

test("Voice searches for news without a freshness keyword and waits for evidence before speech", async () => {
  let resolveSearch;
  let searched = false;
  let generated = false;
  const search = new Promise(resolve => { resolveSearch = resolve; });
  const { POST } = load("app/api/call/route.ts", {
    "@/lib/firecrawl": { searchWeb: async query => {
      assert.equal(query, "Ada berita apa di Bandung terkini");
      searched = true;
      return search;
    } },
    "@/lib/assistant/webSearchQuery": load("lib/assistant/webSearchQuery.ts", {
      "../firecrawl": { cleanSearchQuery: text => text.trim() },
    }),
    "@/lib/ai": {
      hasAiKey: () => true,
      aiChatStream: async ({ system }) => {
        generated = true;
        assert.match(system, /Berita Bandung/);
        assert.match(system, /Eureka sudah melakukan pencarian web/);
        return { content: "Ada kabar dari Bandung." };
      },
    },
    "@/lib/serverAnalytics": { captureServerEvent: async () => {} },
    "@/lib/after": { runAfter() {} },
    "@/lib/assistant/auth": { requireAuth: async () => ({ userId: "ordinary-user" }) },
    "@/lib/prompts/safety": { AI_SAFETY_GUARDRAIL: "" },
    "@/lib/prompts/momoPersona": { momoPersona: () => "" },
    "@/lib/rateLimit": { ensureRateLimitPrune() {}, checkRateLimit: () => ({ ok: true }) },
  });
  const response = await POST(new Request("https://eureka.example/api/call", {
    method: "POST",
    body: JSON.stringify({
      question: "Ada berita apa di Bandung", stream: true,
      history: [{ role: "user", content: "Siapa penemu telepon?" }],
    }),
  }));
  const reader = response.body.getReader();
  const first = await reader.read();
  assert.equal(JSON.parse(new TextDecoder().decode(first.value)).type, "searching");
  assert.equal(searched, true);
  assert.equal(generated, false);
  resolveSearch([{ title: "Berita Bandung", url: "https://www.bandung.go.id", description: "Agenda kota" }]);
  assert.equal(JSON.parse(new TextDecoder().decode((await reader.read()).value)).type, "text");
  await reader.cancel();
});

test("Speech starts on the first streamed sentence before the AI finishes", async () => {
  let finish;
  const waiting = new Promise(resolve => { finish = resolve; });
  let speechReady;
  const firstSpeech = new Promise(resolve => { speechReady = resolve; });
  const { POST } = load("app/api/call/route.ts", {
    "@/lib/firecrawl": { searchWeb: () => { throw new Error("A greeting should not search"); } },
    "@/lib/assistant/webSearchQuery": {},
    "@/lib/ai": {
      hasAiKey: () => true,
      aiChatStream: async (_options, emit) => {
        emit({ type: "token", text: "Halo, saya akan membantu kamu. " });
        await waiting;
        emit({ type: "token", text: "Mari kita mulai." });
        return { content: "Halo, saya akan membantu kamu. Mari kita mulai." };
      },
    },
    "@/lib/serverAnalytics": { captureServerEvent: async () => {} },
    "@/lib/after": { runAfter() {} },
    "@/lib/assistant/auth": { requireAuth: async () => ({ userId: "ordinary-user" }) },
    "@/lib/prompts/safety": { AI_SAFETY_GUARDRAIL: "" },
    "@/lib/prompts/momoPersona": { momoPersona: () => "" },
    "@/lib/rateLimit": { ensureRateLimitPrune() {}, checkRateLimit: () => ({ ok: true }) },
  });
  const response = await POST(new Request("https://eureka.example/api/call", {
    method: "POST", body: JSON.stringify({ question: "Halo", stream: true }),
  }));
  const { readCallReply } = load("lib/audio/callReply.ts", {});
  const speech = [];
  const reading = readCallReply(response, () => {}, text => { speech.push(text); speechReady(); });
  await firstSpeech;
  assert.deepEqual(speech, ["Halo, saya akan membantu kamu."]);
  finish();
  assert.equal(await reading, "Halo, saya akan membantu kamu. Mari kita mulai.");
  assert.deepEqual(speech, ["Halo, saya akan membantu kamu.", "Mari kita mulai."]);
});

test("An interrupted AI reply is reported instead of being accepted as complete", async () => {
  const { readCallReply } = load("lib/audio/callReply.ts", {});
  const response = new Response(JSON.stringify({ type: "text", text: "Jawaban parsial" }) + "\n", {
    headers: { "Content-Type": "application/x-ndjson" },
  });
  await assert.rejects(() => readCallReply(response, () => {}, () => {}), /terputus/);
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
