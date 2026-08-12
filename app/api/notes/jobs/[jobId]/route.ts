/**
 * GET /api/notes/jobs/[jobId] — status job pembuatan catatan yang berjalan
 * di latar belakang (lihat lib/jobQueue.ts). Dipakai klien untuk polling:
 * klien mendapat { jobId, status } seketika (202) lalu memantau status di
 * sini dari halaman mana pun, sampai "done" (noteId tersedia) atau "error".
 */
import { NextRequest, NextResponse } from "next/server";

import { cancelJob, getJob } from "@/lib/jobQueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const job = getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: "Job tidak ditemukan atau sudah kedaluwarsa." },
        { status: 404 }
      );
    }
    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        percent: job.percent,
        message: job.message,
        noteId: job.noteId,
        noteTitle: job.noteTitle,
        error: job.error,
        cancelled: job.cancelled ?? false,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal membaca status job.";
    console.error("[api/notes/jobs/[jobId]]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/notes/jobs/[jobId] — batalkan job yang sedang berjalan.
 * Proses berhenti di checkpoint berikutnya; catatan tidak disimpan.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const job = getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: "Job tidak ditemukan atau sudah selesai." },
        { status: 404 }
      );
    }
    if (!cancelJob(jobId)) {
      return NextResponse.json(
        { message: "Job sudah selesai atau gagal — tidak ada yang dibatalkan.", cancelled: false },
        { status: 409 }
      );
    }
    return NextResponse.json({ cancelled: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal membatalkan job.";
    console.error("[api/notes/jobs/[jobId]] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
