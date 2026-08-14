import { NextRequest, NextResponse } from "next/server";

import { getRoomByToken, QuizLiveError } from "@/lib/quizLive";

export const runtime = "nodejs";

/**
 * GET /api/quiz-rooms/[token] — info room publik (soal + partisipan
 * tanpa jawaban). Token tak dikenal / prefix salah → 404.
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
    const room = await getRoomByToken(trimmed);
    if (!room) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({
      id: room.id,
      token: room.token,
      status: room.status,
      createdAt: room.createdAt,
      questions: room.questions,
      participants: room.participants,
    });
  } catch (e) {
    if (e instanceof QuizLiveError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[api/quiz-rooms/[token]] GET", e);
    return NextResponse.json({ error: "Gagal memuat ruang." }, { status: 500 });
  }
}