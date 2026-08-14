/**
 * POST /api/notes/[id]/bab/[chapterId]/regenerate — REGENERATE SATU BAB.
 *
 * Menulis ulang bab via AI (konten lama sebagai acuan), menyimpan chapters
 * baru ke Supabase, lalu menyinkronkan ulang chunks RAG. Berjalan sebagai
 * job background (pola sama dengan /api/notes/process) → 202 { jobId }.
 * Status: GET /api/notes/jobs/[jobId].
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { runAfter } from "@/lib/after";
import { getNoteWithChunks } from "@/lib/rag/store";
import { regenerateChapter } from "@/lib/regenerate";
import { getUserIdFromAuth } from "@/lib/assistant/auth";
import { enforcePremium, recordFeatureUsage } from "@/lib/premium";
import { canStartGeneration, createJob, executeJob, updateJob } from "@/lib/jobQueue";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; chapterId: string }> }
) {
  try {
    const { id, chapterId } = await params;
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

    const chapterIndex = (found.note.chapters ?? []).findIndex(
      (c) => String(c.id) === String(chapterId)
    );
    if (chapterIndex === -1) {
      return NextResponse.json(
        { error: "Bab tidak ditemukan." },
        { status: 404 }
      );
    }

    const instruction = String(body?.instruction ?? "").trim().slice(0, 500);

    // Keamanan: userId diambil dari token sesi (apiFetch melampirkan Bearer).
    const userId =
      (await getUserIdFromAuth(req.headers.get("authorization"))) || "anonymous";

    // Gating premium: kuota tulis ulang bab bulanan untuk free.
    const premiumBab = await enforcePremium(userId, "bab-regenerate");
    if (!premiumBab.ok) {
      return NextResponse.json(
        { error: premiumBab.error, upgradeUrl: premiumBab.upgradeUrl },
        { status: premiumBab.status ?? 402 }
      );
    }

    // Rate limit per user (proteksi token AI): maks 5 regenerate/jam.
    ensureRateLimitPrune();
    const rl = checkRateLimit(`regenerate-bab:${userId}`, 5, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        {
          error:
            "Kamu sudah menulis ulang bab terlalu sering dalam 1 jam. Tunggu sebentar ya 🙏",
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
          ? "Server sedang sibuk. Coba lagi dalam beberapa menit ya 🙏"
          : "Kamu masih punya catatan yang sedang diproses. Tunggu sampai selesai ya 🙏";
      return NextResponse.json({ error: busy }, { status: 429 });
    }

    const noteId = found.note.id;

    const jobId = createJob({
      sessionId: randomUUID(),
      userId,
      run: async (id) => {
        try {
          const chapter = await regenerateChapter(
            found.note,
            found.note.chapters![chapterIndex],
            instruction || undefined,
            undefined,
            (percent, message) => updateJob(id, { percent, message })
          );
          updateJob(id, {
            status: "done",
            percent: 100,
            message: "Selesai! Bab ditulis ulang.",
            noteId,
            noteTitle: `Bab ${chapter.id}: ${chapter.title}`,
          });
          // Catat pemakaian (kuota free) setelah berhasil.
          if (userId && userId !== "anonymous") {
            await recordFeatureUsage(userId, "bab-regenerate");
          }
        } catch (e) {
          const msg =
            e instanceof Error
              ? e.message
              : "Terjadi kesalahan saat menulis ulang bab.";
          console.error("[regenerate bab] Job gagal:", e);
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
      { jobId, status: "queued", message: "AI menulis ulang bab di latar belakang." },
      { status: 202 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal menulis ulang bab.";
    console.error("[api/notes/[id]/bab/[chapterId]/regenerate]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
