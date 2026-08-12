#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
const env = {};
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !line.trim().startsWith("#")) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

async function dump(name, baseUrl, apiKey, model) {
  console.log(`--- ${name} (${model}) ---`);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "Say: OK" }], max_tokens: 30 }),
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    console.log(`HTTP ${res.status}`);
    console.log(text.slice(0, 600));
  } catch (e) {
    console.log(`ERR ${e.message}`);
  }
  console.log();
}

await dump("OpenAgentic", env.OPENAGENTIC_BASE_URL, env.OPENAGENTIC_API_KEY, env.OPENAGENTIC_MODEL);

const jr = await fetch(`${env.JUANROUTER_BASE_URL}/models`, {
  headers: { Authorization: `Bearer ${env.JUANROUTER_API_KEY}` },
  signal: AbortSignal.timeout(15_000),
}).catch((e) => e);
console.log("--- JuanRouter /models ---");
if (jr instanceof Error) {
  console.log("ERR", jr.message);
} else {
  const data = await jr.json().catch(() => null);
  const ids = data?.data?.map((m) => m.id) ?? [];
  console.log(`HTTP ${jr.status} — ${ids.length} model`);
  console.log(ids.slice(0, 60).join("\n"));
}
