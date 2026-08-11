import { NextRequest, NextResponse } from "next/server";

import { generateHighlightsForChapters } from "@/lib/ai-highlights";
import { getNoteWithChunks } from "@/lib/rag/store";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Generate (atau regenerasi) stabilo AI untuk sebuah catatan. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await getNoteWithChunks(id);
    if (!data) {
      return NextResponse.json({ error: "Catatan tidak ditemukan." }, { status: 404 });
    }
    const chapters = data.note.chapters ?? [];
    if (chapters.length === 0) {
      return NextResponse.json(
        { error: "Catatan belum memiliki bab." },
        { status: 422 }
      );
    }
    const count = await generateHighlightsForChapters(id, chapters);
    return NextResponse.json({ count });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Gagal membuat stabilo AI.";
    console.error("[api/notes/[id]/highlights/generate]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
