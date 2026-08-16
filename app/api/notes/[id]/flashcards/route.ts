import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/assistant/auth";
import { getNoteWithChunks } from "@/lib/rag/store";
import { generateFlashcards } from "@/lib/studyTools";

export const runtime = "nodejs";
export const maxDuration = 60;

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

    const found = await getNoteWithChunks(id);
    if (!found) {
      return NextResponse.json(
        { error: "Catatan tidak ditemukan." },
        { status: 404 }
      );
    }
    if (found.note.user_id !== auth.userId) {
      return NextResponse.json(
        { error: "Akses ditolak. Kamu bukan pemilik catatan ini." },
        { status: 403 }
      );
    }

    const chapters = found.note.chapters ?? [];
    if (chapters.length === 0) {
      return NextResponse.json(
        { error: "Catatan belum punya bab. Buat catatan ulang agar bisa dibuatkan flashcards." },
        { status: 422 }
      );
    }

    const cards = await generateFlashcards(id, chapters, 8);
    if (cards.length === 0) {
      return NextResponse.json(
        { error: "AI tidak menghasilkan kartu yang valid. Coba lagi." },
        { status: 500 }
      );
    }

    return NextResponse.json({ cards });
  } catch (e) {
    const msg = "Gagal membuat flashcards.";
    console.error("[api/notes/[id]/flashcards]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
