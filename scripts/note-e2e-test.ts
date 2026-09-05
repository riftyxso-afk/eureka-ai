// @ts-nocheck
/**
 * E2E test perbaikan note-from-chat (task 4.1) — backend :3001.
 * 1) Mint token via service-role (alur sama dgn extension login).
 * 2) POST /api/notes/process file 5 karakter → HARUS 400 "terlalu pendek".
 * 3) POST file materi belajar asli (mode cepat) → 202, poll job s/d done,
 *    cek DB: status completed + note_id terisi (bukti fix race).
 * 4) Bersihkan: hapus catatan & baris job test.
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
  // 1) Token utk owner.
  const gl = await fetch(SUPA + "/auth/v1/admin/generate_link", {
    method: "POST",
    headers: { apikey: SRV, Authorization: "Bearer " + SRV, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", email: "radzfoundation@gmail.com" }),
  });
  const glj = await gl.json();
  if (!glj.hashed_token) { console.error("GAGAL generate_link:", JSON.stringify(glj).slice(0, 200)); process.exit(1); }
  const vr = await fetch(SUPA + "/auth/v1/verify", {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", token_hash: glj.hashed_token }),
  });
  const vj = await vr.json();
  if (!vj.access_token) { console.error("GAGAL mint token:", JSON.stringify(vj).slice(0, 200)); process.exit(1); }
  const token = vj.access_token;
  console.log("token ok utk owner");

  // 2) File terlalu pendek → 400.
  const short = new FormData();
  short.append("sources", JSON.stringify([{ type: "dokumen", fileName: "pendek.txt" }]));
  short.append("file0", new File(["halo"], "pendek.txt", { type: "text/plain" }));
  short.append("userId", OWNER_ID);
  short.append("generationMode", "cepat");
  const r1 = await fetch(API + "/api/notes/process", {
    method: "POST", headers: { Authorization: "Bearer " + token }, body: short,
  });
  const j1 = await r1.json().catch(() => null);
  check("file pendek → 400", r1.status === 400, { status: r1.status, j1 });
  check("pesan 400 jelas", /terlalu pendek/i.test(String(j1?.error || "")), j1);

  // 3) Materi asli → 202 + job selesai + DB completed dgn note_id.
  const materi = [
    "Fotosintesis adalah proses tumbuhan mengubah cahaya, air, dan CO2 menjadi glukosa dan oksigen.",
    "Terjadi di kloroplas: reaksi terang di tilakoid menghasilkan ATP dan NADPH.",
    "Reaksi gelap (siklus Calvin) di stroma fixing CO2 menjadi gula menggunakan ATP dan NADPH.",
    "Faktor laju fotosintesis: intensitas cahaya, suhu, konsentrasi CO2, dan air.",
  ].join("\n");
  const form = new FormData();
  form.append("sources", JSON.stringify([{ type: "dokumen", fileName: "fotosintesis.txt" }]));
  form.append("file0", new File([materi], "fotosintesis.txt", { type: "text/plain" }));
  form.append("userId", OWNER_ID);
  form.append("generationMode", "cepat");
  form.append("studyMode", "ringkas");
  form.append("chapterCount", "2");
  const r2 = await fetch(API + "/api/notes/process", {
    method: "POST", headers: { Authorization: "Bearer " + token, "x-session-id": "e2e-race-test" }, body: form,
  });
  const j2 = await r2.json().catch(() => null);
  check("materi valid → 202", r2.status === 202, { status: r2.status, j2 });
  const jobId = j2?.jobId;
  if (!jobId) { console.error("tanpa jobId — hentikan"); process.exit(1); }

  // Poll s/d 4 menit.
  let job = null;
  for (let i = 0; i < 80; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const jr = await fetch(SUPA + "/rest/v1/jobs?id=eq." + jobId + "&select=status,progress,message,note_id", {
      headers: { apikey: SRV, Authorization: "Bearer " + SRV },
    });
    const rows = await jr.json();
    job = rows[0];
    if (job && job.status !== "processing") break;
    if (i % 10 === 0) console.log("  ...", job?.progress + "%", job?.message);
  }
  check("job DB: completed", job?.status === "completed", job);
  check("job DB: note_id terisi", !!job?.note_id, job);

  // 4) Bersihkan catatan + job test.
  if (job?.note_id) {
    await fetch(SUPA + "/rest/v1/notes?id=eq." + job.note_id, {
      method: "DELETE", headers: { apikey: SRV, Authorization: "Bearer " + SRV, Prefer: "return=minimal" },
    });
    console.log("catatan test dihapus:", job.note_id);
  }
  await fetch(SUPA + "/rest/v1/jobs?id=eq." + jobId, {
    method: "DELETE", headers: { apikey: SRV, Authorization: "Bearer " + SRV, Prefer: "return=minimal" },
  });
  console.log("job test dihapus.");
  console.log(fail ? fail + " GAGAL" : "E2E SEMUA LOLOS");
  process.exit(fail ? 1 : 0);
}
void main();
