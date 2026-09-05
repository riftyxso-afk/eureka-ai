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
import { requireAuth } from "@/lib/assistant/auth";
import { languageFromRequest } from "@/lib/locale";
import { canStartGeneration, createJob, executeJob, updateJob } from "@/lib/jobQueue";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";
import { getPremiumStatus } from "@/lib/premium";
import { runWithPremium } from "@/lib/aiContext";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req.headers.get("authorization"));
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
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
    if (found.note.user_id !== auth.userId) {
      return NextResponse.json(
        { error: "Akses ditolak. Kamu bukan pemilik catatan ini." },
        { status: 403 }
      );
    }

    if (!found.note.chapters || found.note.chapters.length === 0) {
      return NextResponse.json(
        { error: "Catatan belum punya bab untuk ditulis ulang." },
        { status: 422 }
      );
    }

    const instruction = String(body?.instruction ?? "").trim().slice(0, 500);

    // Keamanan: userId dari token sesi (apiFetch melampirkan Bearer).
    const userId = auth.userId;

    // Rate limit per user (proteksi token AI): maks 5 regenerate/jam.
    ensureRateLimitPrune();
    const rl = checkRateLimit(`regenerate:${userId}`, 5, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        {
          error:
            "Kamu sudah menulis ulang catatan terlalu sering dalam 1 jam. Tunggu sebentar ya.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
        }
      );
    }

    // Kapasitas generate serentak (lintas server): global 5 / per-user 1.
    const cap = await canStartGeneration(userId);
    if (!cap.ok) {
      const busy =
        cap.reason === "global"
          ? "Server sedang sibuk. Coba lagi dalam beberapa menit ya."
          : "Kamu masih punya catatan yang sedang diproses. Tunggu sampai selesai ya.";
      return NextResponse.json({ error: busy }, { status: 429 });
    }

    const noteId = found.note.id;

    // Status premium → konteks model AI job regenerate (Pro = model pintar).
    const isPremiumUser = (await getPremiumStatus(userId)).isPremium;

    const jobId = createJob({
      sessionId: randomUUID(),
      userId,
      run: async (id) =>
        runWithPremium(isPremiumUser, async () => {
        try {
          const chapters = await regenerateAllChapters(
            found.note,
            instruction || undefined,
            {
              studyMode: "standar",
              gayaPenulisan: "Ramah & Santai",
              // Bahasa tulis-ulang mengikuti locale user (id/en).
              bahasa: languageFromRequest(req),
            },
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
          const msg = "Terjadi kesalahan saat menulis ulang catatan.";
          console.error("[regenerate catatan] Job gagal:", e);
          updateJob(id, {
            status: "error",
            error: msg,
            message: "Proses gagal.",
            percent: 100,
          });
        }
      }),
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
    const msg = "Gagal menulis ulang catatan.";
    console.error("[api/notes/[id]/regenerate]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
