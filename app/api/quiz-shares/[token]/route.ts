import { NextRequest, NextResponse } from "next/server";

import { getShareByToken, QuizLiveError } from "@/lib/quizLive";

export const runtime = "nodejs";

/**
 * GET /api/quiz-shares/[token] — ambil snapshot kuis TANPA auth.
 * Token tak dikenal / prefix salah → 404 (bukan 403) agar tidak
 * mengungkap token tebakan.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const trimmed = token.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const share = await getShareByToken(trimmed);
    if (!share) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({
      title: share.noteTitle,
      questions: share.questions,
    });
  } catch (e) {
    if (e instanceof QuizLiveError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[api/quiz-shares/[token]] GET", e);
    return NextResponse.json({ error: "Gagal memuat kuis." }, { status: 500 });
  }
}