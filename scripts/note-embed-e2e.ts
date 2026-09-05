/**
 * E2E embed catatan multi-sumber (task 1.1/3.1): dokumen + YouTube →
 * note.sourceUrl HARUS link YouTube; lalu bersihkan.
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
const YT_URL = "https://www.youtube.com/watch?v=tpkI3K0yJ-Y"; // Crash Course Biology — fotosintesis

let fail = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (cond) console.log("ok:", name);
  else { fail++; console.error("GAGAL:", name, JSON.stringify(got)); }
}

async function main() {
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
  const token = vj.access_token;
  if (!token) { console.error("GAGAL token"); process.exit(1); }

  const materi = "Perang Dunia I dipicu pembunuhan Archduke Franz Ferdinand 1914. Aliansi Yunani kuno dalam Perang Peloponesus menunjukkan persaingan Athena dan Sparta menyebabkan kehancuran. Pertempuran Marathon melibatkan pasukan Persia dan Yunani. Strategi militer dan pengepungan kota menjadi bagian kelam sejarah.";
  const form = new FormData();
  // URUTAN SENGAJA: dokumen dulu (tanpa sourceUrl), YouTube kedua —
  // kasus lama: sourceUrl hanya dibaca dari sumber pertama → embed hilang.
  form.append("sources", JSON.stringify([
    { type: "dokumen", fileName: "ringkas.txt" },
    { type: "youtube", url: YT_URL },
  ]));
  form.append("file0", new File([materi], "ringkas.txt", { type: "text/plain" }));
  form.append("userId", OWNER_ID);
  form.append("generationMode", "cepat");
  form.append("studyMode", "ringkas");
  form.append("chapterCount", "2");

  const r2 = await fetch(API + "/api/notes/process", {
    method: "POST", headers: { Authorization: "Bearer " + token, "x-session-id": "e2e-embed-test" }, body: form,
  });
  const j2 = await r2.json();
  check("multi-sumber → 202", r2.status === 202, { s: r2.status, j2 });
  const jobId = j2?.jobId;
  if (!jobId) process.exit(1);

  let job: Record<string, unknown> | null = null;
  for (let i = 0; i < 100; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const rows = await fetch(SUPA + "/rest/v1/jobs?id=eq." + jobId + "&select=status,progress,message,note_id", {
      headers: { apikey: SRV, Authorization: "Bearer " + SRV },
    }).then((r) => r.json());
    job = rows[0];
    if (job && job.status !== "processing") break;
    if (i % 10 === 0) console.log("  ...", (job as { progress?: number })?.progress + "%", (job as { message?: string })?.message);
  }
  check("job completed", job?.status === "completed", job);
  const noteId = job?.note_id as string | undefined;
  check("note_id ada", !!noteId, job);

  if (noteId) {
    const note = await fetch(SUPA + "/rest/v1/notes?id=eq." + noteId + "&select=title,source_url,subject", {
      headers: { apikey: SRV, Authorization: "Bearer " + SRV },
    }).then((r) => r.json());
    console.log("note:", JSON.stringify(note[0]));
    const src = String(note[0]?.source_url ?? "");
    check("sourceUrl = link YouTube", /youtube\.com|youtu\.be/i.test(src), src);
    // Bersihkan.
    await fetch(SUPA + "/rest/v1/notes?id=eq." + noteId, { method: "DELETE", headers: { apikey: SRV, Authorization: "Bearer " + SRV, Prefer: "return=minimal" } });
    console.log("catatan test dihapus.");
  }
  await fetch(SUPA + "/rest/v1/jobs?id=eq." + jobId, { method: "DELETE", headers: { apikey: SRV, Authorization: "Bearer " + SRV, Prefer: "return=minimal" } });
  console.log(fail ? fail + " GAGAL" : "E2E EMBED SEMUA LOLOS");
  process.exit(fail ? 1 : 0);
}
void main();
