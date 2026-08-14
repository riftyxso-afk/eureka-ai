import { NextRequest, NextResponse } from "next/server";

import { QuizLiveError, submitRoomAnswers } from "@/lib/quizLive";

export const runtime = "nodejs";

/**
 * POST /api/quiz-rooms/[token]/submit — partisipan mengirim jawaban.
 * Body: { participantKey, answers: {questionId: indeksOpsi} }.
 * Submit ganda → 409; room belum live / sudah berakhir → 409.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = (await req.json().catch(() => null)) as {
      participantKey?: unknown;
      answers?: unknown;
    } | null;
    if (
      !body ||
      typeof body.participantKey !== "string" ||
      !body.participantKey ||
      typeof body.answers !== "object" ||
      body.answers === null
    ) {
      return NextResponse.json(
        { error: "participantKey dan answers diperlukan." },
        { status: 400 }
      );
    }
    const answers: Record<string, number> = {};
    for (const [k, v] of Object.entries(body.answers as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) answers[k] = v;
    }
    const result = await submitRoomAnswers({
      roomToken: token,
      participantKey: body.participantKey,
      answers,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof QuizLiveError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[api/quiz-rooms/[token]/submit] POST", e);
    return NextResponse.json({ error: "Gagal mengirim jawaban." }, { status: 500 });
  }
}