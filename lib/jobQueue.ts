/**
 * Job background untuk pembuatan catatan (pola in-memory + persist Supabase).
 *
 * POST /api/notes/process membalas 202 { jobId } seketika; pekerjaan berat
 * (ekstraksi, bab AI, enrichment, RAG, kuis) dijalankan setelah respons lewat
 * `after()` (Next.js 16 — jalan di Vercel maupun self-hosted). User bebas
 * pindah halaman tanpa membatalkan proses; status job dipantau lewat
 * GET /api/notes/jobs/[id].
 *
 * Status juga di-persist ke tabel `public.jobs` Supabase sehingga polling
 * tetap menemukan job walaupun request berikutnya masuk ke instance
 * serverless yang berbeda (sebelumnya in-memory saja → 404 lintas instance).
 *
 * Catatan:
 * - Di Vercel, kerja `after()` berjalan dalam batas maxDuration; bila terpotong,
 *   job tertinggal berstatus "running" dan dianggap gagal saat sudah basi
 *   (lihat STALE_RUNNING_MS).
 * - Tanpa Supabase terkonfigurasi (dev), fallback ke in-memory.
 */
import { randomUUID } from "crypto";
import { db } from "@/lib/supabase/admin";

export type JobStatus = "running" | "done" | "error";

export interface NoteJob {
  id: string;
  sessionId: string;
  userId: string;
  status: JobStatus;
  percent: number;
  message: string;
  noteId?: string;
  noteTitle?: string;
  error?: string;
  cancelled?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateJobOptions {
  sessionId: string;
  userId: string;
  /** Kerja background; terima jobId agar bisa update progress dari dalam. */
  run: (jobId: string) => Promise<void>;
}

const JOBS_TTL_MS = 60 * 60 * 1000;
const MAX_JOBS = 200;
/** Job yang basi (tidak ada update) dianggap mati, agar klien tidak menunggu selamanya. */
const STALE_RUNNING_MS = 10 * 60 * 1000;

const jobs = new Map<string, NoteJob>();
const runners = new Map<string, (jobId: string) => Promise<void>>();

function nowIso(): string {
  return new Date().toISOString();
}

function toDbStatus(status: JobStatus): string {
  return status === "running" ? "processing" : status === "done" ? "completed" : "failed";
}

function fromDbStatus(status: string | null, cancelled: boolean): JobStatus {
  if (cancelled) return "error";
  if (status === "completed") return "done";
  if (status === "failed") return "error";
  return "running";
}

/** Persist status ke tabel jobs Supabase. Gagal diam-diam (fallback memory). */
async function persist(job: NoteJob): Promise<void> {
  try {
    await db()
      .from("jobs")
      .upsert(
        {
          id: job.id,
          progress: job.percent,
          status: toDbStatus(job.status),
          message: job.message,
          note_id: job.noteId ?? null,
          result: {
            noteTitle: job.noteTitle ?? null,
            error: job.error ?? null,
            cancelled: job.cancelled ?? false,
          },
          updated_at: nowIso(),
        },
        { onConflict: "id" }
      );
  } catch {
    // Supabase tidak terkonfigurasi — tetap jalan in-memory.
  }
}

async function loadFromDb(jobId: string): Promise<NoteJob | null> {
  try {
    const { data } = await db()
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();
    if (!data) return null;
    const result = (data.result ?? {}) as {
      noteTitle?: string | null;
      error?: string | null;
      cancelled?: boolean;
    };
    const status = fromDbStatus(data.status, !!result.cancelled);
    if (
      status === "running" &&
      Date.now() - new Date(data.updated_at ?? data.created_at).getTime() >
        STALE_RUNNING_MS
    ) {
      // Job "processing" yang basi = mati di tengah jalan (mis. fungsi terpotong).
      return {
        id: data.id,
        sessionId: "",
        userId: "",
        status: "error",
        percent: 100,
        message: "Proses gagal.",
        error: "Waktu proses habis. Coba lagi.",
        createdAt: new Date(data.created_at).getTime(),
        updatedAt: Date.now(),
      };
    }
    return {
      id: data.id,
      sessionId: "",
      userId: "",
      status,
      percent: data.progress ?? 0,
      message: data.message ?? "",
      noteId: data.note_id ?? undefined,
      noteTitle: result.noteTitle ?? undefined,
      error: result.error ?? undefined,
      cancelled: result.cancelled,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
    };
  } catch {
    return null;
  }
}

function cleanup() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.updatedAt > JOBS_TTL_MS) jobs.delete(id);
  }
  if (jobs.size > MAX_JOBS) {
    const sorted = [...jobs.entries()].sort(
      (a, b) => a[1].updatedAt - b[1].updatedAt
    );
    for (const [id] of sorted.slice(0, jobs.size - MAX_JOBS)) {
      jobs.delete(id);
      runners.delete(id);
    }
  }
}

export function createJob(options: CreateJobOptions): string {
  cleanup();
  const id = randomUUID();
  const job: NoteJob = {
    id,
    sessionId: options.sessionId,
    userId: options.userId,
    status: "running",
    percent: 0,
    message: "Menyiapkan proses...",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  jobs.set(id, job);
  runners.set(id, options.run);
  void persist(job);
  return id;
}

/**
 * Jalankan kerja job setelah respons HTTP selesai.
 * Dipanggil lewat `after()` di route handler (Vercel & self-hosted).
 */
export function executeJob(jobId: string): Promise<void> {
  const run = runners.get(jobId) ?? (async () => {});
  return run(jobId);
}

export async function updateJob(
  jobId: string,
  patch: Partial<Pick<NoteJob, "status" | "percent" | "message" | "noteId" | "noteTitle" | "error">>
): Promise<void> {
  const job = jobs.get(jobId) ?? (await loadFromDb(jobId));
  if (!job) return;
  Object.assign(job, patch, { updatedAt: Date.now() });
  jobs.set(jobId, job);
  void persist(job);
}

export async function getJob(jobId: string): Promise<NoteJob | null> {
  cleanup();
  const cached = jobs.get(jobId);
  if (cached) return cached;
  const fromDb = await loadFromDb(jobId);
  if (fromDb) jobs.set(jobId, fromDb);
  return fromDb;
}

export async function cancelJob(jobId: string): Promise<boolean> {
  const job = jobs.get(jobId) ?? (await loadFromDb(jobId));
  if (!job || job.status !== "running") return false;
  job.cancelled = true;
  job.status = "error";
  job.error = "Dibatalkan oleh pengguna.";
  job.message = "Proses dibatalkan.";
  job.updatedAt = Date.now();
  jobs.set(jobId, job);
  void persist(job);
  return true;
}

/** Apakah job sudah dibatalkan (dipakai prosesor untuk berhenti di antara fase). */
export async function isJobCancelled(jobId: string): Promise<boolean> {
  const job = jobs.get(jobId) ?? (await loadFromDb(jobId));
  return job?.cancelled ?? false;
}

/** Error yang dilempar saat job dibatalkan di tengah proses. */
export class JobCancelledError extends Error {
  constructor() {
    super("Job dibatalkan.");
    this.name = "JobCancelledError";
  }
}