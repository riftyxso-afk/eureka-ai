/**
 * Test koneksi provider AI aktif (baca .env.local root repo).
 * Jalankan: node scripts/test-ai-provider.mjs
 */
import { readFileSync } from "node:fs";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = {};
for (const m of raw.matchAll(/^(?!#)([A-Z0-9_]+)=(.*)$/gm)) {
  env[m[1]] = m[2].trim();
}

const provider = env.AI_PROVIDER || "openagentic";
const map = {
  openrouter: ["OPENROUTER_BASE_URL", "OPENROUTER_API_KEY", "OPENROUTER_MODEL"],
  openagentic: ["OPENAGENTIC_BASE_URL", "OPENAGENTIC_API_KEY", "OPENAGENTIC_MODEL"],
  aimurah: ["AI_BASE_URL", "AI_API_KEY", "AI_MODEL"],
  "9router": ["NINE_ROUTER_BASE_URL", "NINE_ROUTER_API_KEY", "NINE_ROUTER_MODEL"],
};
const [bK, kK, mK] = map[provider] ?? map.openagentic;
const base = (env[bK] ?? "").replace(/\/+$/, "");
const key = env[kK];
const model = env[mK];

console.log(`Provider : ${provider}`);
console.log(`Base URL : ${base}`);
console.log(`Model    : ${model}`);
console.log(`API Key  : ${key ? key.slice(0, 8) + "…" + `(${key.length} chars)` : "KOSONG!"}`);

if (!base || !key) {
  console.error("FAIL — base URL / API key tidak lengkap.");
  process.exit(1);
}

const t0 = Date.now();
try {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Eureka.AI connectivity test",
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      messages: [
        { role: "user", content: "Balas HANYA dengan satu kata: TERHUBUNG" },
      ],
    }),
  });
  const ms = Date.now() - t0;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    console.error(`FAIL — HTTP ${res.status} (${ms}ms)`);
    console.error(JSON.stringify(data?.error ?? data, null, 2)?.slice(0, 500));
    process.exit(1);
  }
  const msg = data?.choices?.[0]?.message ?? {};
  const content =
    msg.content || msg.reasoning ||
    JSON.stringify(data).slice(0, 300);
  const used = data?.model ?? "(model tidak dilaporkan)";
  const finish = data?.choices?.[0]?.finish_reason ?? "-";
  console.log(`OK — HTTP ${res.status} dalam ${ms}ms (finish: ${finish})`);
  console.log(`Model terpakai : ${used}`);
  console.log(`Reasoning      : ${String(msg.reasoning ?? "").slice(0, 100) || "-"}`);
  console.log(`Balasan        : ${String(content).slice(0, 120)}`);
} catch (e) {
  console.error(`FAIL — ${e.message}`);
  process.exit(1);
}
