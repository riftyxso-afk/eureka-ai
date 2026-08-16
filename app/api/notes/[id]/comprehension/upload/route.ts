import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/assistant/auth";
import { getNoteWithChunks } from "@/lib/rag/store";
import { extractQuestionsFromSheet } from "@/lib/studyTools";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

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

    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string" || !("arrayBuffer" in file)) {
      return NextResponse.json(
        { error: "Unggah file lembar soal dulu (foto JPG/PNG atau PDF)." },
        { status: 400 }
      );
    }
    const upload = file as File;
    if (upload.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "File terlalu besar (maksimal 8 MB)." },
        { status: 413 }
      );
    }
    const buffer = Buffer.from(await upload.arrayBuffer());
    if (!buffer.length) {
      return NextResponse.json(
        { error: "File yang diunggah kosong." },
        { status: 400 }
      );
    }

    const questions = await extractQuestionsFromSheet(buffer, upload.name);
    return NextResponse.json({ questions });
  } catch (e) {
    console.error("[api/notes/[id]/comprehension/upload]", e);
    const detail = e instanceof Error ? e.message : "";
    // Pesan sengaja dari ekstraksi → 422 agar UI menampilkan petunjuk
    // spesifik; exception internal → 500 dengan pesan generik.
    if (/tidak terbaca|tidak punya teks|Format file/i.test(detail)) {
      return NextResponse.json({ error: detail }, { status: 422 });
    }
    return NextResponse.json(
      { error: "Gagal membaca lembar soal. Coba unggah ulang." },
      { status: 500 }
    );
  }
}
