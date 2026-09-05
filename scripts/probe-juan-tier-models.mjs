// Petakan status semua model di SPEED_MODEL_LISTS pada Juan Router.
import { readFileSync } from "fs";
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i > 0 && !line.trim().startsWith("#")) process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const BASE = (process.env.JUANROUTER_BASE_URL ?? "https://router.juan.web.id/v1").replace(/\/$/, "");
const KEY = process.env.JUANROUTER_API_KEY ?? "";
const H = { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` };

const TIERS = {
  fast: ["deepseek-v4-flash-vision-exp", "gemini-3.7-flash-low", "deepseek-v4-pro", "qwen3.8-max"],
  normal: ["deepseek-v4-pro", "deepseek-v4-pro-0813", "gemini-3.7-flash-high", "minimax-m3", "qwen3.8-max"],
  deep: ["gpt-5.6-terra", "gpt-5.6-luna", "grok-4.6", "claude-opus-5", "muse-spark-1.2"],
};
const seen = new Set();
const targets = [];
for (const list of Object.values(TIERS)) for (const m of list) if (!seen.has(m)) { seen.add(m); targets.push(m); }
// + beberapa model terdaftar di luar daftar untuk kandidat pengganti
for (const m of ["gemini-3.5-flash-lite", "gemini-3.8-flash-low", "glm-5.3-flash", "gpt-5.6-sol", "hy-4-preview", "qwen3.8-27b"]) {
  if (!seen.has(m)) targets.push(m);
}

async function test(model) {
  const t0 = Date.now();
  try {
    const r = await fetch(`${BASE}/chat/completions`, {
      method: "POST", headers: H, signal: AbortSignal.timeout(45000),
      body: JSON.stringify({ model, messages: [{ role: "user", content: "Jawab satu kata: air" }], max_tokens: 30, stream: false }),
    });
    const txt = await r.text();
    if (r.status === 200) {
      const j = JSON.parse(txt);
      const content = j.choices?.[0]?.message?.content;
      return `${model}: OK 200 (${Date.now() - t0}ms) content=${JSON.stringify(String(content ?? "(kosong)").slice(0, 40))}`;
    }
    const msg = (txt.match(/"message":"([^"]{0,120})/) ?? ["", ""])[1];
    const kind = /insufficient balance/.test(txt) ? "NO_BALANCE" : /model_not_found|No available channel/.test(txt) ? "NO_CHANNEL" : `HTTP ${r.status}`;
    return `${model}: ${kind} (${Date.now() - t0}ms) — ${msg.slice(0, 100)}`;
  } catch (e) {
    return `${model}: ERROR ${e.name} (${Date.now() - t0}ms)`;
  }
}

async function main() {
  for (const m of targets) console.log(await test(m));
}
void main();
