import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/assistant/auth";
import { getNoteWithChunks } from "@/lib/rag/store";
import {
  generateComprehension,
  type ComprehensionConfig,
} from "@/lib/studyTools";
import { languageFromRequest } from "@/lib/locale";

export const runtime = "nodejs";
export const maxDuration = 60;

const DIFFICULTIES = ["mudah", "sedang", "sulit"] as const;

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
    const body = (await req.json().catch(() => null)) as Partial<ComprehensionConfig> | null;
    const count = Math.min(Math.max(Number(body?.count) || 5, 3), 15);
    const difficulty = DIFFICULTIES.includes(body?.difficulty as never)
      ? (body!.difficulty as ComprehensionConfig["difficulty"])
      : "sedang";
    const rawTypes = Array.isArray(body?.types) ? body!.types : ["abc", "essay"];
    const types = rawTypes.filter((t) => t === "abc" || t === "essay");
    if (types.length === 0) {
      return NextResponse.json(
        { error: "Pilih minimal satu tipe soal (pilihan ganda atau essay)." },
        { status: 400 }
      );
    }

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
        { error: "Catatan belum punya materi. Buat catatan ulang agar bisa dibuatkan soal uji pemahaman." },
        { status: 422 }
      );
    }

    const questions = await generateComprehension(
      id,
      found.note.title,
      chapters,
      { count, difficulty, types },
      languageFromRequest(req)
    );
    if (questions.length === 0) {
      return NextResponse.json(
        { error: "AI tidak menghasilkan soal yang valid. Coba lagi." },
        { status: 500 }
      );
    }

    return NextResponse.json({ questions });
  } catch (e) {
    const msg = "Gagal membuat soal uji pemahaman.";
    console.error("[api/notes/[id]/comprehension]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
