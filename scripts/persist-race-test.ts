// @ts-nocheck
/**
 * Test race persist jobQueue (perbaikan 1b) — tulis ke tabel jobs asli,
 * baris test dihapus di akhir. Jalankan:
 *   node --env-file=.env.local backend/node_modules/tsx/dist/cli.mjs scripts/persist-race-test.ts
 */
import { randomUUID } from "crypto";
import { createJob, updateJob, getJob } from "../lib/jobQueue";

const env = process.env;
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPA_KEY = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

async function dbRead(id: string) {
  const r = await fetch(`${SUPA_URL}/rest/v1/jobs?id=eq.${id}&select=status,progress,message,note_id`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
  });
  const text = await r.text();
  try {
    const rows = JSON.parse(text) as Array<Record<string, unknown>>;
    return Array.isArray(rows) ? rows[0] ?? null : { __raw: text };
  } catch {
    return { __raw: text };
  }
}
async function dbDelete(id: string) {
  await fetch(`${SUPA_URL}/rest/v1/jobs?id=eq.${id}`, {
    method: "DELETE",
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Prefer": "return=minimal" },
  });
}

let fail = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (cond) console.log(`ok: ${name}`);
  else { fail++; console.error(`GAGAL: ${name}`, JSON.stringify(got)); }
}

async function dbAnyNoteId(): Promise<string | null> {
  const r = await fetch(`${SUPA_URL}/rest/v1/notes?select=id&limit=1`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
  });
  const rows = (await r.json()) as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}

async function main() {
  if (!SUPA_URL || !SUPA_KEY) { console.error("env tidak lengkap"); process.exit(1); }

  // note_id punya FK ke tabel notes — pakai id catatan asli yang ada.
  const noteId = await dbAnyNoteId();
  if (!noteId) { console.error("tidak ada catatan utk FK test"); process.exit(1); }

  // Replikasi urutan route: beberapa update progress beruntun TANPA await,
  // lalu update terminal DI-AWAIT (perbaikan 1b.2).
  const jobId = createJob({ sessionId: "test-race", userId: "test-race", run: async () => {} });

  void updateJob(jobId, { percent: 90, message: "Menyimpan ke knowledge base..." });
  void updateJob(jobId, { percent: 100, message: "Selesai! Catatan siap dipelajari." });
  void updateJob(jobId, { percent: 100, message: "Selesai!" });
  await updateJob(jobId, { status: "done", percent: 100, message: "Selesai!", noteId, noteTitle: "Judul Test" });

  // Baca DB langsung — status final HARUS completed + note_id terisi.
  const row = await dbRead(jobId);
  check("DB: status completed", row?.status === "completed", row);
  check("DB: note_id terisi", row?.note_id === noteId, row);
  check("DB: message final", row?.message === "Selesai!", row);

  // getJob (jalur polling klien) harus melihat done + noteId.
  const job = await getJob(jobId);
  check("getJob: status done", job?.status === "done", job?.status);
  check("getJob: noteId ada", job?.noteId === noteId, job?.noteId);

  await dbDelete(jobId);
  console.log("baris test dihapus.");
  console.log(fail ? `${fail} GAGAL` : "semua lolos");
  process.exit(fail ? 1 : 0);
}

void main();
