import { NextRequest, NextResponse } from "next/server";

import {
  deleteSession,
  getMessages,
  getSession,
  renameSession,
} from "@/lib/assistant/store";
import { authorizeAssistantUser } from "@/lib/assistant/auth";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
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
    const userId = auth.userId;
    const session = await getSession(sessionId, userId);
    if (!session) {
      return NextResponse.json(
        { error: "Sesi tidak ditemukan." },
        { status: 404 }
      );
    }
    const messages = await getMessages(sessionId, userId);
    return NextResponse.json({ session, messages });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal memuat sesi.";
    console.error("[api/assistant/sessions/[sessionId]] GET", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = (await req.json().catch(() => null)) as {
      userId?: string;
      title?: string;
    } | null;
    const rawUserId = String(body?.userId ?? "").trim();
    const title = String(body?.title ?? "").trim().slice(0, 120);
    if (!rawUserId || !title) {
      return NextResponse.json(
        { error: "userId dan title diperlukan." },
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
    await renameSession(sessionId, auth.userId, title);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal mengganti judul.";
    console.error("[api/assistant/sessions/[sessionId]] PATCH", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
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
    await deleteSession(sessionId, auth.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal menghapus sesi.";
    console.error("[api/assistant/sessions/[sessionId]] DELETE", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}