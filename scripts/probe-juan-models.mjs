// Follow-up: daftar model lengkap + supported_endpoint_types + uji chat pada model yang TERDAFTAR.
import { readFileSync } from "fs";
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i > 0 && !line.trim().startsWith("#")) process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const BASE = (process.env.JUANROUTER_BASE_URL ?? "https://router.juan.web.id/v1").replace(/\/$/, "");
const KEY = process.env.JUANROUTER_API_KEY ?? "";
const H = { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` };

async function main() {
  const r = await fetch(`${BASE}/models`, { headers: H, signal: AbortSignal.timeout(30000) });
  const data = (await r.json()).data ?? [];
  console.log("== DAFTAR MODEL LENGKAP (" + data.length + ") ==");
  for (const m of data) {
    console.log(`  ${m.id}  [${(m.supported_endpoint_types ?? []).join(",")}]`);
  }
  const withEmbed = data.filter((m) => (m.supported_endpoint_types ?? []).some((t) => /embed/i.test(t)));
  const withAudio = data.filter((m) => (m.supported_endpoint_types ?? []).some((t) => /audio|transcri/i.test(t)));
  console.log("\nModel dengan endpoint embedding:", withEmbed.map((m) => m.id));
  console.log("Model dengan endpoint audio:", withAudio.map((m) => m.id));

  // Uji chat pada model terdaftar pertama + satu model dari daftar SPEED.
  const candidates = [];
  if (data[0]?.id) candidates.push(data[0].id);
  if (data.length > 1 && data[1]?.id && data[1].id !== candidates[0]) candidates.push(data[1].id);
  for (const model of candidates) {
    const t0 = Date.now();
    const c = await fetch(`${BASE}/chat/completions`, {
      method: "POST", headers: H, signal: AbortSignal.timeout(60000),
      body: JSON.stringify({ model, messages: [{ role: "user", content: "Jawab satu kata: air" }], max_tokens: 20, stream: false }),
    });
    const txt = await c.text();
    console.log(`\n== chat(${model}): HTTP ${c.status} in ${Date.now() - t0}ms`);
    console.log("  ", txt.replace(/\s+/g, " ").slice(0, 260));
  }
}
void main();
