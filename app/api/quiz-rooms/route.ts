import { NextRequest, NextResponse } from "next/server";

import { getUserIdFromAuth } from "@/lib/assistant/auth";
import { createRoom, QuizLiveError } from "@/lib/quizLive";

export const runtime = "nodejs";

/**
 * POST /api/quiz-rooms — buat ruang live dari sebuah share (auth user).
 * Body: { shareToken, hostName } → { token, url, participantKey }.
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
      shareToken?: unknown;
      hostName?: unknown;
    } | null;
    if (!body || typeof body.shareToken !== "string" || !body.shareToken.trim()) {
      return NextResponse.json(
        { error: "shareToken diperlukan." },
        { status: 400 }
      );
    }
    const hostName =
      typeof body.hostName === "string" ? body.hostName.trim() : "";

    const room = await createRoom({
      shareToken: body.shareToken.trim(),
      hostName,
    });
    // URL dibangun client-side (origin frontend, bukan backend).
    return NextResponse.json(
      { token: room.token, participantKey: room.participantKey },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof QuizLiveError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[api/quiz-rooms] POST", e);
    return NextResponse.json({ error: "Gagal membuat ruang." }, { status: 500 });
  }
}