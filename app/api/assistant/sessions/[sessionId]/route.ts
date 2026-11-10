import { NextRequest, NextResponse } from "next/server";

import {
  deleteSession,
  getMessages,
  getSession,
  renameSession,
  updateArtifactMessage,
} from "@/lib/assistant/store";
import { editMessageArtifact } from "@/lib/assistant/artifacts";
import { requirePro } from "@/lib/assistant/auth";

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
    const auth = await requirePro(
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
    const msg = "Gagal memuat sesi.";
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
      artifact?: { messageId: string; index: number; content: string; previousContent: string };
    } | null;
    const rawUserId = String(body?.userId ?? "").trim();
    const title = String(body?.title ?? "").trim().slice(0, 120);
    if (!rawUserId || (!title && !body?.artifact)) {
      return NextResponse.json(
        { error: "userId dan title diperlukan." },
        { status: 400 }
      );
    }
    const auth = await requirePro(
      req.headers.get("authorization"),
      rawUserId
    );
    if (!auth.userId) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status ?? 401 }
      );
    }
    if (body?.artifact) {
      if (!(await getSession(sessionId, auth.userId))) {
        return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 404 });
      }
      const edit = body.artifact;
      if (typeof edit.messageId !== "string" || !Number.isInteger(edit.index) || edit.index < 0 ||
          typeof edit.content !== "string" || typeof edit.previousContent !== "string" || edit.content.length > 200_000) {
        return NextResponse.json({ error: "Edit artifact tidak valid." }, { status: 400 });
      }
      let content: string;
      try { content = editMessageArtifact(edit.previousContent, edit.index, edit.content); }
      catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Edit tidak valid." }, { status: 400 });
      }
      const saved = await updateArtifactMessage(sessionId, edit.messageId, edit.previousContent, content);
      if (!saved) return NextResponse.json({ error: "Artifact berubah. Muat ulang sebelum menyimpan." }, { status: 409 });
      return NextResponse.json({ ok: true, content });
    }
    await renameSession(sessionId, auth.userId, title);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = "Gagal mengganti judul.";
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
    const auth = await requirePro(
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
    const msg = "Gagal menghapus sesi.";
    console.error("[api/assistant/sessions/[sessionId]] DELETE", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}