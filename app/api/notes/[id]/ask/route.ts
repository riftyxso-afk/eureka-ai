import { NextRequest, NextResponse } from "next/server";

import { getNoteWithChunks } from "@/lib/rag/store";
import { embedTexts } from "@/lib/rag/embed";
import { searchChunks } from "@/lib/rag/store";
import { aiChat, hasAiKey } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!hasAiKey()) {
      return NextResponse.json(
        { error: "API key AI belum diatur di .env.local." },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      question?: string;
    } | null;
    const question = String(body?.question ?? "").trim().slice(0, 500);
    if (!question) {
      return NextResponse.json(
        { error: "Pertanyaan tidak boleh kosong." },
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

    const [embedding] = await embedTexts([question], "query");
    const results = await searchChunks(embedding, 4, id);

    if (results.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada bagian materi yang cocok dengan pertanyaanmu." },
        { status: 422 }
      );
    }

    const context = results
      .map(
        (r, i) =>
          `[Bagian ${i + 1} — ${r.noteTitle}]${r.noteSubject ? ` (${r.noteSubject})` : ""}\n${r.text}`
      )
      .join("\n\n---\n\n");

    const answer = await aiChat({
      system:
        "Kamu adalah asisten belajar Eureka.AI yang ramah. Jawab pertanyaan HANYA berdasarkan konteks materi yang diberikan, dalam bahasa Indonesia yang jelas dan terstruktur. Jika jawaban tidak ada di konteks, katakan dengan jujur bahwa hal itu tidak ditemukan di materi, lalu sarankan pertanyaan lain.",
      user: `KONTEKS MATERI (dari catatan "${found.note.title}"):\n\n${context.slice(0, 24000)}\n\nPERTANYAAN:\n${question}`,
      maxTokens: 1200,
      temperature: 0.4,
    });

    return NextResponse.json({ answer: answer.trim() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal menjawab pertanyaan.";
    console.error("[api/notes/[id]/ask]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
