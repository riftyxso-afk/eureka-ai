import { NextRequest, NextResponse } from "next/server";

import { getMessages, getSession } from "@/lib/assistant/store";
import { authorizeAssistantUser } from "@/lib/assistant/auth";
import { enforcePremium, recordFeatureUsage } from "@/lib/premium";
import {
  buildStudyContext,
  collectMentionIds,
  loadMentionedNotes,
} from "@/lib/assistant/studyContext";
import { generateQuizFromContext } from "@/lib/studyTools";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Buat kuis dari percakapan sesi chat (command /kuis).
 * Materi: seluruh pesan sesi + catatan yang di-mention di sesi itu.
 * Hanya pemilik sesi yang bisa — diverifikasi via token + kepemilikan sesi.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      sessionId?: string;
      userId?: string;
      count?: number;
    } | null;
    const sessionId = String(body?.sessionId ?? "").trim();
    const rawUserId = String(body?.userId ?? "").trim();
    if (!sessionId || !rawUserId) {
      return NextResponse.json(
        { error: "sessionId dan userId diperlukan." },
        { status: 400 }
      );
    }
    const auth = await authorizeAssistantUser(
      req.headers.get("authorization"),
      rawUserId
    );
    if (!auth.userId) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status ?? 401 }
      );
    }

    // Gating premium: kuota kuis AI harian untuk free.
    const premiumQuiz = await enforcePremium(auth.userId, "assistant-quiz");
    if (!premiumQuiz.ok) {
      return NextResponse.json(
        { error: premiumQuiz.error, upgradeUrl: premiumQuiz.upgradeUrl },
        { status: premiumQuiz.status ?? 402 }
      );
    }

    const session = await getSession(sessionId, auth.userId);
    if (!session) {
      return NextResponse.json(
        { error: "Sesi tidak ditemukan." },
        { status: 404 }
      );
    }

    const messages = await getMessages(sessionId, auth.userId);
    if (messages.length === 0) {
      return NextResponse.json(
        {
          error:
            "Belum ada materi di sesi ini. Mulai percakapan dulu sebelum membuat kuis ya!",
        },
        { status: 422 }
      );
    }

    const count = Math.min(Math.max(Number(body?.count) || 5, 3), 10);
    const notes = await loadMentionedNotes(collectMentionIds(messages));
    const context = buildStudyContext(messages, notes);

    const questions = await generateQuizFromContext(context, count);
    if (questions.length === 0) {
      return NextResponse.json(
        { error: "AI tidak menghasilkan soal yang valid. Coba lagi." },
        { status: 500 }
      );
    }

    // Catat pemakaian (kuota free) setelah berhasil.
    await recordFeatureUsage(auth.userId, "assistant-quiz");

    return NextResponse.json({ questions });
  } catch (e) {
    const msg = "Gagal membuat kuis.";
    console.error("[api/assistant/quiz] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
