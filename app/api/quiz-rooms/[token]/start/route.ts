import { NextRequest, NextResponse } from "next/server";

import { startRoom, QuizLiveError } from "@/lib/quizLive";

export const runtime = "nodejs";

/**
 * POST /api/quiz-rooms/[token]/start — host memulai ruang.
 * Body: { hostKey }. Hanya dari status lobby.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = (await req.json().catch(() => null)) as {
      hostKey?: unknown;
    } | null;
    if (!body || typeof body.hostKey !== "string" || !body.hostKey) {
      return NextResponse.json(
        { error: "hostKey diperlukan." },
        { status: 400 }
      );
    }
    await startRoom({ roomToken: token, hostKey: body.hostKey });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof QuizLiveError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[api/quiz-rooms/[token]/start] POST", e);
    return NextResponse.json({ error: "Gagal memulai ruang." }, { status: 500 });
  }
}