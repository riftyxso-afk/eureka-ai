import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/assistant/auth";
import { getNoteWithChunks } from "@/lib/rag/store";
import {
  addHighlight,
  listHighlights,
  removeHighlight,
  type HighlightColor,
} from "@/lib/highlights-store";

export const runtime = "nodejs";

async function ensureOwner(
  noteId: string,
  userId: string
): Promise<NextResponse | null> {
  const found = await getNoteWithChunks(noteId);
  if (!found) {
    return NextResponse.json(
      { error: "Catatan tidak ditemukan." },
      { status: 404 }
    );
  }
  if (found.note.user_id !== userId) {
    return NextResponse.json(
      { error: "Akses ditolak. Kamu bukan pemilik catatan ini." },
      { status: 403 }
    );
  }
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req.headers.get("authorization"));
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await params;
    const denied = await ensureOwner(id, auth.userId);
    if (denied) return denied;
    const chapterIdRaw = req.nextUrl.searchParams.get("chapterId");
    const chapterId =
      chapterIdRaw != null && chapterIdRaw !== ""
        ? Number(chapterIdRaw)
        : undefined;
    const highlights = await listHighlights(
      id,
      Number.isFinite(chapterId) ? chapterId : undefined
    );
    return NextResponse.json({ highlights });
  } catch (e) {
    const msg = "Gagal memuat highlight.";
    console.error("[api/notes/[id]/highlights] GET", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req.headers.get("authorization"));
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await params;
    const denied = await ensureOwner(id, auth.userId);
    if (denied) return denied;
    const body = (await req.json().catch(() => null)) as {
      chapterId?: number;
      text?: string;
      color?: HighlightColor;
      userId?: string;
    } | null;
    const text = String(body?.text ?? "").trim();
    if (!text) {
      return NextResponse.json(
        { error: "Teks yang di-highlight tidak boleh kosong." },
        { status: 400 }
      );
    }
    const chapterId = Number(body?.chapterId);
    const color: HighlightColor =
      body?.color === "pink" || body?.color === "blue" ? body.color : "yellow";
    const entry = await addHighlight({
      noteId: id,
      chapterId: Number.isFinite(chapterId) ? chapterId : 1,
      text,
      color,
      userId: auth.userId,
    });
    return NextResponse.json({ highlight: entry });
  } catch (e) {
    const msg = "Gagal menyimpan highlight.";
    console.error("[api/notes/[id]/highlights] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req.headers.get("authorization"));
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await params;
    const denied = await ensureOwner(id, auth.userId);
    if (denied) return denied;
    const highlightId = String(req.nextUrl.searchParams.get("id") ?? "");
    if (!highlightId) {
      return NextResponse.json(
        { error: "id highlight diperlukan." },
        { status: 400 }
      );
    }
    const ok = await removeHighlight(id, highlightId);
    return NextResponse.json({ ok });
  } catch (e) {
    const msg = "Gagal menghapus highlight.";
    console.error("[api/notes/[id]/highlights] DELETE", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
