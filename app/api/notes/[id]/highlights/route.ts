import { NextRequest, NextResponse } from "next/server";

import {
  addHighlight,
  listHighlights,
  removeHighlight,
  type HighlightColor,
} from "@/lib/highlights-store";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    const msg = e instanceof Error ? e.message : "Gagal memuat highlight.";
    console.error("[api/notes/[id]/highlights] GET", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      userId: String(body?.userId ?? "unknown"),
    });
    return NextResponse.json({ highlight: entry });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal menyimpan highlight.";
    console.error("[api/notes/[id]/highlights] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    const msg = e instanceof Error ? e.message : "Gagal menghapus highlight.";
    console.error("[api/notes/[id]/highlights] DELETE", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
