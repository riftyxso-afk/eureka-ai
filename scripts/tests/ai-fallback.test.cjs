/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const ROOT = path.resolve(__dirname, "../..");

function streamChunks(chunks) {
  const enc = new TextEncoder();
  const payload = chunks.map(c => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`).join("") + "data: [DONE]\n\n";
  const stream = new ReadableStream({
    start(c) { c.enqueue(enc.encode(payload)); c.close(); },
  });
  return { ok: true, status: 200, body: stream, headers: new Headers() };
}

function loadAiWithEnv(env, fetchImpl) {
  const cache = new Map();
  const resolveFile = spec => {
    const base = spec.startsWith("@/") ? path.join(ROOT, spec.slice(2)) : path.resolve(ROOT, spec);
    for (const cand of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
    }
    return null;
  };
  const compile = file => {
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} };
    cache.set(file, mod);
    const out = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    });
    const ctx = vm.createContext({
      module: mod,
      exports: mod.exports,
      require: spec => {
        if (spec === "openai") return class OpenAI {};
        const hit = resolveFile(spec);
        if (hit) return compile(hit);
        const rel = spec.startsWith(".") ? resolveFile(path.relative(ROOT, path.resolve(path.dirname(file), spec))) : null;
        if (rel) return compile(rel);
        return require(spec);
      },
      process: { env: { ...env } },
      fetch: fetchImpl,
      console: { log() {}, warn() {}, error() {} },
      AbortController,
      AbortSignal,
      TextDecoder,
      TextEncoder,
      ReadableStream,
      Headers,
      Response,
      setTimeout,
      clearTimeout,
      Promise,
      JSON,
      Date,
      Math,
      Error,
      Set,
      Map,
    });
    new vm.Script(out.outputText, { filename: file }).runInContext(ctx);
    return mod.exports;
  };
  return compile(path.join(ROOT, "lib/ai.ts"));
}

test("provider chain orders JuanRouter -> OpenRouter -> NusaRouter (nusarouter.com)", () => {
  const ai = loadAiWithEnv({
    JUANROUTER_API_KEY: "sk-juan",
    OPENROUTER_API_KEY: "sk-or",
    NUSAROUTER_API_KEY: "sk-nusa",
  }, async () => streamChunks(["ok"]));

  const chain = ai.getProviderChain("normal");
  const providers = [...new Set(chain.map(p => p.name))];
  assert.deepEqual(providers, ["JuanRouter", "OpenRouter", "NusaRouter"]);

  const openRouter = chain.filter(p => p.name === "OpenRouter");
  assert.deepEqual([...openRouter.map(p => p.model)], ["openrouter/free"]);

  const nusa = chain.filter(p => p.name === "NusaRouter");
  assert.equal(nusa[0].baseURL, "https://api.nusarouter.com/v1");
  assert.deepEqual([...nusa.map(p => p.model)], [
    "openai/gpt-oss-120b:free",
    "meta-llama/llama-3.1-70b-instruct:free",
  ]);
});

test("hasAiKey stays true when primary JuanRouter key is empty but fallback keys exist", () => {
  const onlyOpenRouter = loadAiWithEnv({ OPENROUTER_API_KEY: "sk-or" }, async () => streamChunks(["ok"]));
  assert.equal(onlyOpenRouter.hasAiKey(), true);

  const onlyNusa = loadAiWithEnv({ NUSAROUTER_API_KEY: "sk-nusa" }, async () => streamChunks(["ok"]));
  assert.equal(onlyNusa.hasAiKey(), true);

  const none = loadAiWithEnv({}, async () => streamChunks(["ok"]));
  assert.equal(none.hasAiKey(), false);
});

test("JuanRouter 402 skips remaining JuanRouter models and falls back to OpenRouter", async () => {
  const calls = [];
  const ai = loadAiWithEnv({
    JUANROUTER_API_KEY: "sk-juan",
    OPENROUTER_API_KEY: "sk-or",
    NUSAROUTER_API_KEY: "sk-nusa",
  }, async (url, req) => {
    calls.push({ url, headers: req.headers, model: JSON.parse(req.body).model });
    if (url.includes("juanrouter")) {
      return new Response(JSON.stringify({ error: { code: "insufficient_balance", message: "Out of credits" } }), { status: 402 });
    }
    return streamChunks(["Halo ", "OpenRouter"]);
  });

  const out = await ai.aiChat({ user: "Tes" });
  assert.equal(out, "Halo OpenRouter");
  assert.equal(calls.filter(c => c.url.includes("juanrouter")).length, 1);
  assert.equal(calls.filter(c => c.url.includes("openrouter")).length, 1);
  assert.equal(calls[1].headers["X-Title"], "Eureka.AI");
});

test("JuanRouter 402 + OpenRouter 402 skips directly to NusaRouter (api.nusarouter.com)", async () => {
  const calls = [];
  const ai = loadAiWithEnv({
    JUANROUTER_API_KEY: "sk-juan",
    OPENROUTER_API_KEY: "sk-or",
    OPENROUTER_MODEL: "deepseek/deepseek-chat",
    NUSAROUTER_API_KEY: "sk-nusa",
  }, async (url, req) => {
    calls.push({ url, model: JSON.parse(req.body).model });
    if (url.includes("juanrouter")) {
      return new Response(JSON.stringify({ error: { message: "Credit balance depleted" } }), { status: 402 });
    }
    if (url.includes("openrouter")) {
      return new Response(JSON.stringify({ error: { message: "Insufficient credits" } }), { status: 402 });
    }
    if (url.includes("api.nusarouter.com")) {
      return streamChunks(["Halo ", "NusaRouter"]);
    }
    throw new Error(`Unexpected URL ${url}`);
  });

  const out = await ai.aiChat({ user: "Tes", speedMode: "fast" });
  assert.equal(out, "Halo NusaRouter");
  assert.equal(calls.length, 3);
  assert.ok(calls[0].url.includes("juanrouter"));
  assert.ok(calls[1].url.includes("openrouter"));
  assert.equal(calls[2].url, "https://api.nusarouter.com/v1/chat/completions");
  assert.equal(calls[2].model, "openai/gpt-oss-120b:free");
});

test("OpenRouter rate limits across all free models fall through to NusaRouter", async () => {
  const providersHit = [];
  const ai = loadAiWithEnv({
    JUANROUTER_API_KEY: "sk-juan",
    OPENROUTER_API_KEY: "sk-or",
    NUSAROUTER_API_KEY: "sk-nusa",
  }, async (url) => {
    if (url.includes("juanrouter")) {
      providersHit.push("juanrouter");
      return new Response(JSON.stringify({ error: { message: "insufficient_balance" } }), { status: 429 });
    }
    if (url.includes("openrouter")) {
      providersHit.push("openrouter");
      return new Response(JSON.stringify({ error: { message: "Rate limit exceeded" } }), { status: 429 });
    }
    providersHit.push("nusarouter");
    return streamChunks(["Fallback akhir NusaRouter"]);
  });

  const out = await ai.aiChat({ user: "Tes" });
  assert.equal(out, "Fallback akhir NusaRouter");
  assert.equal(providersHit.filter(p => p === "juanrouter").length, 1);
  assert.equal(providersHit.filter(p => p === "openrouter").length, ai.OPENROUTER_FREE_MODELS.length);
  assert.equal(providersHit.at(-1), "nusarouter");
});

test("streaming mid-stream failure on OpenRouter triggers onReset and succeeds on NusaRouter", async () => {
  const ai = loadAiWithEnv({
    JUANROUTER_API_KEY: "sk-juan",
    OPENROUTER_API_KEY: "sk-or",
    NUSAROUTER_API_KEY: "sk-nusa",
  }, async (url) => {
    if (url.includes("juanrouter")) {
      return new Response("no credits", { status: 402 });
    }
    if (url.includes("openrouter")) {
      const enc = new TextEncoder();
      let sent = false;
      const broken = new ReadableStream({
        pull(controller) {
          if (!sent) {
            sent = true;
            controller.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "Sepotong" } }] })}\n\n`));
          } else {
            controller.error(new Error("stream cut"));
          }
        },
      });
      return { ok: true, status: 200, body: broken, headers: new Headers() };
    }
    return streamChunks(["Utuh ", "NusaRouter"]);
  });

  const tokens = [];
  let resets = 0;
  const res = await ai.aiChatStream(
    { user: "Tes stream", onReset: () => { resets++; tokens.length = 0; } },
    ev => { if (ev.type === "token") tokens.push(ev.text); }
  );
  assert.equal(res.content, "Utuh NusaRouter");
  assert.equal(res.provider, "NusaRouter");
  assert.equal(resets, ai.OPENROUTER_FREE_MODELS.length);
  assert.deepEqual(tokens, ["Utuh ", "NusaRouter"]);
});

test("throws clear credit-exhaustion error when all providers return 402", async () => {
  const ai = loadAiWithEnv({
    JUANROUTER_API_KEY: "sk-juan",
    OPENROUTER_API_KEY: "sk-or",
    NUSAROUTER_API_KEY: "sk-nusa",
  }, async () => new Response("no credits", { status: 402 }));

  await assert.rejects(ai.aiChat({ user: "Tes" }), /HTTP 402/);
});

test("does not report all gateways out of credit when another gateway rejects authentication", async () => {
  const ai = loadAiWithEnv({
    JUANROUTER_API_KEY: "sk-juan",
    OPENROUTER_API_KEY: "sk-or",
  }, async (url) => new Response("gateway unavailable", {
    status: url.includes("juanrouter") ? 402 : 401,
  }));

  await assert.rejects(ai.aiChat({ user: "Tes" }), /Model AI belum dapat menjawab/);
});

test("OPENROUTER_MODEL and NUSAROUTER_MODEL prepend custom model overrides before defaults", () => {
  const ai = loadAiWithEnv({
    OPENROUTER_API_KEY: "sk-or",
    OPENROUTER_MODEL: "deepseek/deepseek-chat, openrouter/free",
    NUSAROUTER_API_KEY: "sk-nusa",
    NUSAROUTER_MODEL: "xiaomi/mimo-v2.6-flash",
  }, async () => streamChunks(["ok"]));

  const orModels = ai.getProviderChain("normal").filter(p => p.name === "OpenRouter").map(p => p.model);
  assert.equal(orModels[0], "deepseek/deepseek-chat");
  assert.equal(orModels.filter(m => m === "openrouter/free").length, 1);

  const nusaModels = ai.getProviderChain("fast").filter(p => p.name === "NusaRouter").map(p => p.model);
  assert.equal(nusaModels[0], "xiaomi/mimo-v2.6-flash");
  assert.ok(nusaModels.includes("openai/gpt-oss-120b:free"));
  assert.ok(nusaModels.includes("meta-llama/llama-3.1-70b-instruct:free"));
});

test("NusaRouter falls back from openai/gpt-oss-120b:free to meta-llama/llama-3.1-70b-instruct:free", async () => {
  const nusaModelsCalled = [];
  const ai = loadAiWithEnv({
    JUANROUTER_API_KEY: "sk-juan",
    OPENROUTER_API_KEY: "sk-or",
    NUSAROUTER_API_KEY: "sk-nusa",
  }, async (url, req) => {
    const model = JSON.parse(req.body).model;
    if (url.includes("juanrouter") || url.includes("openrouter")) {
      return new Response("no credits", { status: 402 });
    }
    nusaModelsCalled.push(model);
    if (model === "openai/gpt-oss-120b:free") {
      return new Response(JSON.stringify({ error: { message: "model_rate_limit_exceeded" } }), { status: 429 });
    }
    return streamChunks(["Dijawab oleh Llama NusaRouter"]);
  });

  const out = await ai.aiChat({ user: "Tes fallback model NusaRouter" });
  assert.equal(out, "Dijawab oleh Llama NusaRouter");
  assert.deepEqual(nusaModelsCalled, [
    "openai/gpt-oss-120b:free",
    "meta-llama/llama-3.1-70b-instruct:free",
  ]);
});
