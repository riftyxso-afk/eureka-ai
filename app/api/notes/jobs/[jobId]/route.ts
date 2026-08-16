/**
 * GET /api/notes/jobs/[jobId] — status job pembuatan catatan yang berjalan
 * di latar belakang (lihat lib/jobQueue.ts). Dipakai klien untuk polling:
 * klien mendapat { jobId, status } seketika (202) lalu memantau status di
 * sini dari halaman mana pun, sampai "done" (noteId tersedia) atau "error".
 */
import { NextRequest, NextResponse } from "next/server";

import { cancelJob, getJob } from "@/lib/jobQueue";
import { requireAuth } from "@/lib/assistant/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    // Wajib login; job hanya boleh dibaca pemiliknya.
    const auth = await requireAuth(req.headers.get("authorization"));
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const job = await getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: "Job tidak ditemukan atau sudah kedaluwarsa." },
        { status: 404 }
      );
    }
    if (job.userId !== auth.userId) {
      return NextResponse.json(
        { error: "Akses ditolak. Job ini bukan milikmu." },
        { status: 403 }
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
    const msg = "Gagal membaca status job.";
    console.error("[api/notes/jobs/[jobId]]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/notes/jobs/[jobId] — batalkan job yang sedang berjalan.
 * Proses berhenti di checkpoint berikutnya; catatan tidak disimpan.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    // Wajib login; job hanya boleh dibatalkan pemiliknya.
    const auth = await requireAuth(req.headers.get("authorization"));
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const job = await getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: "Job tidak ditemukan atau sudah selesai." },
        { status: 404 }
      );
    }
    if (job.userId !== auth.userId) {
      return NextResponse.json(
        { error: "Akses ditolak. Job ini bukan milikmu." },
        { status: 403 }
      );
    }
    if (!(await cancelJob(jobId))) {
      return NextResponse.json(
        { message: "Job sudah selesai atau gagal — tidak ada yang dibatalkan.", cancelled: false },
        { status: 409 }
      );
    }
    return NextResponse.json({ cancelled: true });
  } catch (e) {
    const msg = "Gagal membatalkan job.";
    console.error("[api/notes/jobs/[jobId]] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
