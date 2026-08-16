import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/assistant/auth";
import { getNoteWithChunks } from "@/lib/rag/store";
import { generateQuiz } from "@/lib/studyTools";

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
    const body = (await req.json().catch(() => null)) as {
      count?: number;
    } | null;
    const count = Math.min(Math.max(Number(body?.count) || 5, 3), 10);

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
    const msg = "Gagal membuat kuis.";
    console.error("[api/notes/[id]/quiz]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
