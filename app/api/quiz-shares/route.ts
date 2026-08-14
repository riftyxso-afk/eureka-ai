import { NextRequest, NextResponse } from "next/server";

import { getUserIdFromAuth } from "@/lib/assistant/auth";
import {
  createShare,
  QuizLiveError,
  validateQuestions,
} from "@/lib/quizLive";

export const runtime = "nodejs";

/**
 * POST /api/quiz-shares — simpan snapshot kuis (auth user).
 * Body: { noteId, noteTitle, questions } → { token, url }.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromAuth(req.headers.get("authorization"));
    if (!userId) {
      return NextResponse.json(
        { error: "Autentikasi diperlukan. Silakan masuk ulang." },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      noteId?: unknown;
      noteTitle?: unknown;
      questions?: unknown;
    } | null;
    if (!body || typeof body.noteId !== "string" || !body.noteId.trim()) {
      return NextResponse.json(
        { error: "noteId diperlukan." },
        { status: 400 }
      );
    }
    const questions = validateQuestions(body.questions);
    if (questions.length === 0) {
      return NextResponse.json({ error: "Soal kuis kosong." }, { status: 422 });
    }

    const share = await createShare({
      userId,
      noteId: body.noteId.trim(),
      noteTitle: String(body.noteTitle ?? "").slice(0, 160),
      questions,
    });
    // URL dibangun client-side (origin frontend, bukan backend).
    return NextResponse.json({ token: share.token });
  } catch (e) {
    if (e instanceof QuizLiveError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[api/quiz-shares] POST", e);
    return NextResponse.json({ error: "Gagal menyimpan kuis." }, { status: 500 });
  }
}