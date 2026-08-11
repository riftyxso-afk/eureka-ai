import { NextRequest, NextResponse } from "next/server";

import { getNoteWithChunks } from "@/lib/rag/store";
import { generateQuiz, getQuiz } from "@/lib/studyTools";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as {
      count?: number;
    } | null;
    const count = Math.min(Math.max(Number(body?.count) || 5, 3), 10);

    // Kuis otomatis (mode Standar/Lengkap) sudah dibuat saat catatan dibuat.
    const saved = await getQuiz(id);
    if (saved.length > 0) {
      return NextResponse.json({ questions: saved, cached: true });
    }

    const found = await getNoteWithChunks(id);
    if (!found) {
      return NextResponse.json(
        { error: "Catatan tidak ditemukan." },
        { status: 404 }
      );
    }

    const chapters = found.note.chapters ?? [];
    if (chapters.length === 0) {
      return NextResponse.json(
        { error: "Catatan belum punya bab. Buat catatan ulang agar bisa dibuatkan kuis." },
        { status: 422 }
      );
    }

    const questions = await generateQuiz(
      id,
      found.note.title,
      chapters,
      count
    );
    if (questions.length === 0) {
      return NextResponse.json(
        { error: "AI tidak menghasilkan soal yang valid. Coba lagi." },
        { status: 500 }
      );
    }

    return NextResponse.json({ questions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal membuat kuis.";
    console.error("[api/notes/[id]/quiz]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
