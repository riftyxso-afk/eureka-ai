/**
 * Job background untuk pembuatan catatan (pola in-memory seperti
 * ProgressTracker, konsisten dengan arsitektur file-JSON single-process).
 *
 * POST /api/notes/process kini langsung membalas 202 { jobId } dan pekerjaan
 * berat berjalan di latar belakang via createJob — user bebas pindah halaman
 * tanpa membatalkan proses. Status job dipantau lewat GET /api/notes/jobs/[id].
 *
 * Catatan (tradeoff MVP):
 * - Job hilang bila server di-restart di tengah proses (aman: catatan hanya
 *   disimpan di akhir, jadi tidak ada data korup).
 * - Di Vercel serverless, worker ini mati setelah respons — desain ini untuk
 *   self-hosted (next start / dev), sesuai storage file JSON lokal.
 */
import { randomUUID } from "crypto";

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

const jobs = new Map<string, NoteJob>();

function cleanup() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.updatedAt > JOBS_TTL_MS) jobs.delete(id);
  }
  if (jobs.size > MAX_JOBS) {
    // Buang yang paling lama tidak diperbarui
    const sorted = [...jobs.entries()].sort(
      (a, b) => a[1].updatedAt - b[1].updatedAt
    );
    for (const [id] of sorted.slice(0, jobs.size - MAX_JOBS)) {
      jobs.delete(id);
    }
  }
}

export function createJob(options: CreateJobOptions): string {
  cleanup();
  const id = randomUUID();
  jobs.set(id, {
    id,
    sessionId: options.sessionId,
    userId: options.userId,
    status: "running",
    percent: 0,
    message: "Menyiapkan proses...",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Jalankan kerja di latar belakang (tidak menahan respons HTTP).
  const exec = async () => {
    try {
      await options.run(id);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Terjadi kesalahan saat memproses materi.";
      console.error("[jobQueue] Job gagal:", e);
      updateJob(id, {
        status: "error",
        error: msg,
        message: "Proses gagal.",
        percent: 100,
      });
    }
  };
  setImmediate(() => {
    void exec();
  });

  return id;
}

export function updateJob(
  jobId: string,
  patch: Partial<Pick<NoteJob, "status" | "percent" | "message" | "noteId" | "noteTitle" | "error">>
): void {
  const job = jobs.get(jobId);
  if (!job) return;
  Object.assign(job, patch, { updatedAt: Date.now() });
}

export function getJob(jobId: string): NoteJob | null {
  cleanup();
  return jobs.get(jobId) ?? null;
}

export function cancelJob(jobId: string): boolean {
  const job = jobs.get(jobId);
  if (!job || job.status !== "running") return false;
  job.cancelled = true;
  updateJob(jobId, {
    status: "error",
    error: "Dibatalkan oleh pengguna.",
    message: "Proses dibatalkan.",
  });
  return true;
}

/** Apakah job sudah dibatalkan (dipakai prosesor untuk berhenti di antara fase). */
export function isJobCancelled(jobId: string): boolean {
  return jobs.get(jobId)?.cancelled ?? false;
}

/** Error yang dilempar saat job dibatalkan di tengah proses. */
export class JobCancelledError extends Error {
  constructor() {
    super("Job dibatalkan.");
    this.name = "JobCancelledError";
  }
}
