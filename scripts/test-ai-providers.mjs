#!/usr/bin/env node
/**
 * Tes semua provider AI yang dikonfigurasi di .env.local:
 *   1. OpenAgentic   (provider utama)
 *   2. OpenRouter    (fallback pertama)
 *   3. JuanRouter    (fallback terakhir)
 *
 * Masing-masing dikirim prompt kecil lalu diukur waktu & status.
 * Jalankan: node scripts/test-ai-providers.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
const env = {};
try {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#")) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  console.error("Tidak bisa membaca .env.local");
  process.exit(1);
}

const PROMPT = "Jawab hanya dengan satu kata dalam bahasa Indonesia.";

/** Parse body chat completion secara toleran (sebagian gateway menambah "data: [DONE]"). */
function parseBody(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("body tanpa JSON");
    return JSON.parse(text.slice(start, end + 1));
  }
}

async function testChat(name, baseUrl, apiKey, model) {
  if (!apiKey) {
    console.log(`❌ ${name}: SKIP — tidak ada API key di .env.local`);
    return;
  }
  const started = Date.now();
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: PROMPT }],
        max_tokens: 20,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const ms = Date.now() - started;
    const text = await res.text();
    if (!res.ok) {
      console.log(`❌ ${name} (${model}): HTTP ${res.status} dalam ${ms}ms — ${text.slice(0, 180)}`);
      return;
    }
    const data = parseBody(text);
    const content = data?.choices?.[0]?.message?.content?.trim() ?? "(kosong)";
    console.log(`✅ ${name} (${model}): ${ms}ms — "${content.slice(0, 60)}"`);
  } catch (e) {
    console.log(`❌ ${name} (${model}): ${Date.now() - started}ms — ${e.message}`);
  }
}

console.log("=== Tes Provider AI ===\n");
await testChat(
  "OpenAgentic (utama)",
  env.OPENAGENTIC_BASE_URL ?? "https://openagentic.id/api/v1",
  env.OPENAGENTIC_API_KEY,
  env.OPENAGENTIC_MODEL ?? "claude-sonnet-4.5"
);
await testChat(
  "OpenRouter (fallback 1)",
  env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  env.OPENROUTER_API_KEY,
  env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini"
);
await testChat(
  "JuanRouter (fallback 2)",
  env.JUANROUTER_BASE_URL ?? "https://router.juan.web.id/v1",
  env.JUANROUTER_API_KEY,
  env.JUANROUTER_MODEL ?? "ling-3.0-flash-free"
);
console.log("\nSelesai.");
