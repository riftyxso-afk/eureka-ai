// Verifikasi endpoint Juan Router: /models, chat (3 tier), /embeddings, /audio/transcriptions.
// Muat .env.local dulu agar key terbaca.
import { readFileSync } from "fs";
try {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0 && !line.trim().startsWith("#")) {
      process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
} catch {}

const BASE = (process.env.JUANROUTER_BASE_URL ?? "https://router.juan.web.id/v1").replace(/\/$/, "");
const KEY = process.env.JUANROUTER_API_KEY ?? "";
if (!KEY) { console.log("JUANROUTER_API_KEY kosong"); process.exit(1); }
const H = { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` };

async function timed(label, url, opts, showMs = true) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(60000), ...opts });
    const txt = await r.text();
    let body = txt.slice(0, 300);
    console.log(`\n== ${label}: HTTP ${r.status} in ${Date.now() - t0}ms`);
    console.log("  body:", body.replace(/\s+/g, " ").slice(0, 300));
    return { status: r.status, txt };
  } catch (e) {
    console.log(`\n== ${label}: ERROR ${e.name} ${e.message} after ${Date.now() - t0}ms`);
    return { status: 0, txt: "" };
  }
}

async function main() {
  // 1) /models
  const models = await timed("GET /models", `${BASE}/models`, { headers: H });
  let modelIds = [];
  try { modelIds = JSON.parse(models.txt).data?.map((m) => m.id) ?? []; } catch {}
  console.log(`  total model: ${modelIds.length}`);
  console.log("  semua model:", JSON.stringify(modelIds));
  const embedModels = modelIds.filter((id) => /embed|bge|e5-/i.test(id));
  console.log("  model embedding terdeteksi:", embedModels.slice(0, 10));
  const tts = modelIds.filter((id) => /whisper|transcri|speech|tts/i.test(id));
  console.log("  model audio terdeteksi:", tts.slice(0, 10));

  // 2) chat — satu model per tier
  const tiers = {
    fast: "deepseek-v4-flash-vision-exp",
    normal: "deepseek-v4-pro",
    deep: "claude-opus-5",
  };
  for (const [tier, model] of Object.entries(tiers)) {
    await timed(`chat/${tier} (${model})`, `${BASE}/chat/completions`, {
      method: "POST", headers: H,
      body: JSON.stringify({ model, messages: [{ role: "user", content: "Jawab dengan satu kata: air" }], max_tokens: 20, stream: false }),
    });
  }

  // 3) /embeddings — coba model terdeteksi, lalu fallback umum
  const tryEmbed = embedModels.slice(0, 3).length ? embedModels.slice(0, 3) : ["text-embedding-3-small", "text-embedding-ada-002"];
  for (const m of tryEmbed) {
    const r = await timed(`embeddings (${m})`, `${BASE}/embeddings`, {
      method: "POST", headers: H,
      body: JSON.stringify({ model: m, input: "siklus air" }),
    });
    if (r.status === 200) break;
  }

  // 4) /audio/transcriptions — tanpa file audio: cek ketersediaan endpoint dari kode error
  const fd = new FormData();
  fd.append("model", "whisper-1");
  fd.append("file", new Blob(["dummy"], { type: "audio/mpeg" }), "dummy.mp3");
  await timed("audio/transcriptions (dummy)", `${BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}` },
    body: fd,
  });
}
void main();
