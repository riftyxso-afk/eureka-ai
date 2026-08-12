/**
 * POST /api/notes/[id]/regenerate — REGENERATE SELURUH CATATAN.
 *
 * Menulis ulang SEMUA bab via AI (konten lama sebagai acuan), lalu
 * menyinkronkan chapters + chunks RAG. Job background → 202 { jobId },
 * status: GET /api/notes/jobs/[jobId].
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { runAfter } from "@/lib/after";
import { getNoteWithChunks } from "@/lib/rag/store";
import { regenerateAllChapters } from "@/lib/regenerate";
import { createJob, executeJob, updateJob } from "@/lib/jobQueue";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as {
      instruction?: string;
    } | null;

    const found = await getNoteWithChunks(id);
    if (!found) {
      return NextResponse.json(
        { error: "Catatan tidak ditemukan." },
        { status: 404 }
      );
    }

    if (!found.note.chapters || found.note.chapters.length === 0) {
      return NextResponse.json(
        { error: "Catatan belum punya bab untuk ditulis ulang." },
        { status: 422 }
      );
    }

    const instruction = String(body?.instruction ?? "").trim().slice(0, 500);
    const userId = "anonymous";
    const noteId = found.note.id;

    const jobId = createJob({
      sessionId: randomUUID(),
      userId,
      run: async (id) => {
        try {
          const chapters = await regenerateAllChapters(
            found.note,
            instruction || undefined,
            undefined,
            (percent, message) => updateJob(id, { percent, message })
          );
          updateJob(id, {
            status: "done",
            percent: 100,
            message: "Selesai! Catatan ditulis ulang.",
            noteId,
            noteTitle: found.note.title,
          });
          console.info(
            `[api/notes/[id]/regenerate] Selesai: ${chapters.length} bab untuk ${id}`
          );
        } catch (e) {
          const msg =
            e instanceof Error
              ? e.message
              : "Terjadi kesalahan saat menulis ulang catatan.";
          console.error("[regenerate catatan] Job gagal:", e);
          updateJob(id, {
            status: "error",
            error: msg,
            message: "Proses gagal.",
            percent: 100,
          });
        }
      },
    });

    // Jalankan setelah respons (serverless-safe), bukan setImmediate.
    runAfter(() => {
      void executeJob(jobId);
    });

    return NextResponse.json(
      { jobId, status: "queued", message: "AI menulis ulang catatan di latar belakang." },
      { status: 202 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal menulis ulang catatan.";
    console.error("[api/notes/[id]/regenerate]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
