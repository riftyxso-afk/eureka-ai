import { NextRequest, NextResponse } from "next/server";

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
    const { id } = await params;
    const found = await getNoteWithChunks(id);
    if (!found) {
      return NextResponse.json(
        { error: "Catatan tidak ditemukan." },
        { status: 404 }
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
    const msg =
      e instanceof Error
        ? e.message
        : "Gagal membaca lembar soal. Coba unggah ulang.";
    console.error("[api/notes/[id]/comprehension/upload]", e);
    // Error "tidak terbaca" dari ekstraksi → 422 agar UI menampilkan pesan
    // spesifik; error lain → 500.
    const status = /tidak terbaca|tidak punya teks|Format file/i.test(msg) ? 422 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
