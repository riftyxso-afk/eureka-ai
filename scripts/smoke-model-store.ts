// @ts-nocheck
/**
 * Smoke model-store-selector — backend :3001 (atau argumen).
 * a) model valid (gpt-5.6-terra) → meta SSE memakai model itu.
 * b) model asing (hack-model) → tetap terjawab (mode tier normal).
 * c) model mati di Juan (claude-opus-5) → TETAP terjawab via fallback tier.
 */
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const SRV = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const API = process.argv[2] || "http://localhost:3001";
const OWNER_ID = "30e6cd46-5d2d-4248-ba9d-58e2e13a97e5";

async function mintToken() {
  const gl = await fetch(SUPA + "/auth/v1/admin/generate_link", {
    method: "POST",
    headers: { apikey: SRV, Authorization: "Bearer " + SRV, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", email: "radzfoundation@gmail.com" }),
  }).then((r) => r.json());
  const vj = await fetch(SUPA + "/auth/v1/verify", {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", token_hash: gl.hashed_token }),
  }).then((r) => r.json());
  if (!vj.access_token) throw new Error("GAGAL token");
  return vj.access_token;
}

async function chatOnce(token, label, model) {
  const s = await fetch(API + "/api/assistant/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ userId: OWNER_ID }),
  }).then((r) => r.json());
  const sessionId = s.session?.id;
  if (!sessionId) throw new Error("GAGAL sesi");

  const t0 = Date.now();
  const res = await fetch(API + "/api/assistant/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({
      sessionId, userId: OWNER_ID, question: "Sebutkan satu contoh fotosintesis dalam satu kalimat.",
      speedMode: "deep", model, reasoning: true,
    }),
    signal: AbortSignal.timeout(180000),
  });
  if (!res.ok || !res.body) {
    console.log(`${label}: HTTP ${res.status} ${JSON.stringify(await res.text().catch(() => "")).slice(0, 120)}`);
    return { ok: res.ok, meta: null };
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", meta = null, tokens = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const chunks = buf.split("\n\n");
    buf = chunks.pop() ?? "";
    for (const c of chunks) {
      for (const line of c.split(/\r?\n/)) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        try {
          const ev = JSON.parse(t.slice(5));
          if (ev.type === "meta") meta = `${ev.provider}/${ev.model}`;
          if (ev.type === "token") tokens++;
          if (ev.type === "error") console.log(`${label}: EVENT ERROR:`, ev.message);
        } catch {}
      }
    }
  }
  const ok = tokens > 0;
  console.log(`${label}: ${ok ? "TERJAWAB" : "KOSONG"} (${Date.now() - t0}ms, ${tokens} token) meta=${meta ?? "-"}`);
  return { ok, meta };
}

async function main() {
  const token = await mintToken();
  console.log("token ok\n");
  const a = await chatOnce(token, "a) model valid gpt-5.6-terra", "gpt-5.6-terra");
  const b = await chatOnce(token, "b) model asing hack-model", "hack-model");
  const c = await chatOnce(token, "c) model mati claude-opus-5", "claude-opus-5");

  const pass =
    a.ok && a.meta && a.meta.includes("gpt-5.6-terra") &&
    b.ok &&
    c.ok;
  console.log("\n" + (pass ? "SMOKE MODEL STORE LOLOS" : "SMOKE GAGAL — lihat detail di atas"));
  process.exit(pass ? 0 : 1);
}
void main().catch((e) => { console.error(e); process.exit(1); });
