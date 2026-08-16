import { NextRequest, NextResponse } from "next/server";

import { createSession, listSessions } from "@/lib/assistant/store";
import { authorizeAssistantUser } from "@/lib/assistant/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const rawUserId = String(
      req.nextUrl.searchParams.get("userId") ?? ""
    ).trim();
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
    const sessions = await listSessions(auth.userId);
    return NextResponse.json({ sessions });
  } catch (e) {
    const msg = "Gagal memuat sesi chat.";
    console.error("[api/assistant/sessions] GET", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      userId?: string;
    } | null;
    const rawUserId = String(body?.userId ?? "").trim();
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
    const session = await createSession(auth.userId);
    return NextResponse.json({ session }, { status: 201 });
  } catch (e) {
    const msg = "Gagal membuat sesi chat.";
    console.error("[api/assistant/sessions] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}