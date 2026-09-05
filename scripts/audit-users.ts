// @ts-nocheck
/**
 * Audit keamanan read-only utk daftar email — statistik pemakaian +
 * pemindaian pola serangan (jailbreak/injection/PII) pada pesan user.
 * Tidak menulis apa pun ke DB.
 */
import { readFileSync } from "fs";
import { detectJailbreakHeuristic, detectPiiHeuristic } from "../lib/safety/patterns";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const SRV = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: SRV, Authorization: "Bearer " + SRV };

const EMAILS = [
  "lafifastahdziq@gmail.com",
  "godivabelicia.3112@gmail.com",
  "irineardelia1@gmail.com",
];

async function rest(path: string): Promise<any> {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, { headers: H });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { __raw: t.slice(0, 200) }; }
}

async function main() {
  // Ambil semua user auth sekali (admin API) — cocokkan email.
  const all: { users?: Array<Record<string, any>> } = await fetch(
    SUPA + "/auth/v1/admin/users?per_page=1000", { headers: H }
  ).then((r) => r.json());
  const byEmail = new Map<string, Record<string, any>>(
    (all.users || []).map((u) => [String(u.email || "").toLowerCase(), u])
  );

  for (const email of EMAILS) {
    console.log("\n" + "=".repeat(70));
    console.log("AKUN:", email);
    const u = byEmail.get(email.toLowerCase());
    if (!u) { console.log("  tidak ditemukan"); continue; }
    const uid = u.id;
    console.log("  id:", uid.slice(0, 8), "| dibuat:", (u.created_at || "").slice(0, 10),
      "| login terakhir:", (u.last_sign_in_at || "?").slice(0, 16));

    // Sesi + pesan.
    const sessions = await rest(`ai_chat_sessions?user_id=eq.${uid}&select=id,title,created_at&order=created_at.desc&limit=100`);
    const sids = (Array.isArray(sessions) ? sessions : []).map((s) => s.id);
    console.log("  sesi chat:", sids.length);
    if (sids.length) {
      const msgs = await rest(`ai_chat_messages?session_id=in.(${sids.join(",")})&select=content,role,created_at&order=created_at.desc&limit=2000`);
      const userMsgs = (Array.isArray(msgs) ? msgs : []).filter((m) => m.role === "user");
      console.log("  pesan user:", userMsgs.length, "(dipindai 2000 terakhir)");
      let jb = 0, pii = 0;
      const jbSamples = [];
      for (const m of userMsgs) {
        const isJb = detectJailbreakHeuristic(String(m.content || ""));
        const hasPii = detectPiiHeuristic(String(m.content || "")).length > 0;
        if (isJb) { jb++; if (jbSamples.length < 5) jbSamples.push(String(m.content).slice(0, 120)); }
        if (hasPii) pii++;
      }
      console.log("  pola jailbreak/injection:", jb, jb ? "<<< WASPADA" : "");
      jbSamples.forEach((s) => console.log("    contoh:", JSON.stringify(s)));
      console.log("  pesan memuat PII (email/HP/key):", pii, pii > 3 ? "<<< perhatian" : "");
      // Aktivitas harian.
      const byDay = {};
      userMsgs.forEach((m) => { const d = (m.created_at || "").slice(0, 10); byDay[d] = (byDay[d] || 0) + 1; });
      const days = Object.entries(byDay).sort((a, b) => b[1] - a[1]).slice(0, 5);
      console.log("  hari tersibuk:", days.map(([d, c]) => `${d}(${c})`).join(" "));
    }

    // Catatan milik akun ini.
    const notes = await rest(`notes?user_id=eq.${uid}&select=id,title,created_at&limit=200`);
    console.log("  catatan dibuat:", Array.isArray(notes) ? notes.length : notes);

    // Job generate milik akun ini (result JSON -> userId).
    const jobs = await rest(`jobs?result->>userId=eq.${uid}&select=id,status,created_at&limit=500`);
    const jobList = Array.isArray(jobs) ? jobs : [];
    const failed = jobList.filter((j) => j.status === "failed").length;
    console.log("  job generate:", jobList.length, "| gagal:", failed);

    // Percobaan upgrade/pembayaran?
    const pays = await rest(`payments?user_id=eq.${uid}&select=status,created_at&limit=50`);
    if (Array.isArray(pays)) console.log("  transaksi pembayaran:", pays.length);
  }
  console.log("\n" + "=".repeat(70));
}
void main();
