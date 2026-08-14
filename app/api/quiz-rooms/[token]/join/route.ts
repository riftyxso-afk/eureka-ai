import { NextRequest, NextResponse } from "next/server";

import { joinRoom, QuizLiveError } from "@/lib/quizLive";

export const runtime = "nodejs";

/**
 * POST /api/quiz-rooms/[token]/join — partisipan publik bergabung.
 * Body: { name } → { roomId, participantKey, isHost }.
 * Nama sudah dipakai → 409.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = (await req.json().catch(() => null)) as {
      name?: unknown;
    } | null;
    if (!body || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { error: "Nama diperlukan." },
        { status: 400 }
      );
    }
    const joined = await joinRoom({ roomToken: token, name: body.name });
    return NextResponse.json(joined, { status: 201 });
  } catch (e) {
    if (e instanceof QuizLiveError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[api/quiz-rooms/[token]/join] POST", e);
    return NextResponse.json({ error: "Gagal bergabung." }, { status: 500 });
  }
}