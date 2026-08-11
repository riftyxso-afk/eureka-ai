/**
 * GET /api/notes/jobs/[jobId] — status job pembuatan catatan yang berjalan
 * di latar belakang (lihat lib/jobQueue.ts). Dipakai klien untuk polling:
 * klien mendapat { jobId, status } seketika (202) lalu memantau status di
 * sini dari halaman mana pun, sampai "done" (noteId tersedia) atau "error".
 */
import { NextRequest, NextResponse } from "next/server";

import { getJob } from "@/lib/jobQueue";

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
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal membaca status job.";
    console.error("[api/notes/jobs/[jobId]]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
