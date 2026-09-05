// @ts-nocheck
/**
 * E2E test judul sesi AI (task 4.1) — backend :3001.
 * Sesi baru → kirim 1 pesan chat → tunggu fire-and-forget title → cek DB
 * (bukan "Percakapan baru", bukan preamble) → hapus sesi test.
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

let fail = 0;
function check(name, cond, got) {
  if (cond) console.log("ok:", name);
  else { fail++; console.error("GAGAL:", name, JSON.stringify(got)); }
}

async function main() {
  // Token owner.
  const gl = await fetch(SUPA + "/auth/v1/admin/generate_link", {
    method: "POST",
    headers: { apikey: SRV, Authorization: "Bearer " + SRV, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", email: "radzfoundation@gmail.com" }),
  });
  const glj = await gl.json();
  const vr = await fetch(SUPA + "/auth/v1/verify", {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", token_hash: glj.hashed_token }),
  });
  const vj = await vr.json();
  const token = vj.access_token;
  if (!token) { console.error("GAGAL token"); process.exit(1); }

  // Sesi baru.
  const sr = await fetch(API + "/api/assistant/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ userId: OWNER_ID }),
  });
  const sj = await sr.json();
  const sessionId = sj.session?.id;
  check("sesi dibuat", !!sessionId, sj);

  // Kirim 1 pesan (topik jelas) — konsumsi SSE sampai selesai.
  const cr = await fetch(API + "/api/assistant/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ sessionId, userId: OWNER_ID, question: "jelaskan hukum newton tentang gravitasi" }),
  });
  check("chat 200", cr.status === 200, cr.status);
  const text = await cr.text(); // drain SSE sampai selesai
  check("dapat token jawaban", /"type":"token"/.test(text), text.slice(0, 120));

  // Tunggu fire-and-forget title (AI fast mode) — cek tiap 2 dtk s/d 30 dtk.
  let title = "";
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const tr = await fetch(SUPA + "/rest/v1/ai_chat_sessions?id=eq." + sessionId + "&select=title", {
      headers: { apikey: SRV, Authorization: "Bearer " + SRV },
    });
    const rows = await tr.json();
    title = rows[0]?.title ?? "";
    if (title && title !== "Percakapan baru") break;
  }
  console.log("judul hasil:", JSON.stringify(title));
  check("judul terisi", !!title && title !== "Percakapan baru", title);
  check("bukan preamble thinking", !/thinking|process/i.test(title), title);
  check("judul relevan topik", /newton|gravitasi/i.test(title), title);

  // Bersihkan sesi + pesan test.
  await fetch(SUPA + "/rest/v1/ai_chat_messages?session_id=eq." + sessionId, {
    method: "DELETE", headers: { apikey: SRV, Authorization: "Bearer " + SRV, Prefer: "return=minimal" },
  });
  await fetch(SUPA + "/rest/v1/ai_chat_sessions?id=eq." + sessionId, {
    method: "DELETE", headers: { apikey: SRV, Authorization: "Bearer " + SRV, Prefer: "return=minimal" },
  });
  console.log("sesi test dihapus.");
  console.log(fail ? fail + " GAGAL" : "E2E JUDUL SEMUA LOLOS");
  process.exit(fail ? 1 : 0);
}
void main();
