import { NextRequest, NextResponse } from "next/server";

import { getNoteWithChunks } from "@/lib/rag/store";
import { aiChat, hasAiKey } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; chapterId: string }> }
) {
  try {
    const { id, chapterId } = await params;
    if (!hasAiKey()) {
      return NextResponse.json(
        { error: "API key AI belum diatur di .env.local." },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      question?: string;
      messages?: ChatTurn[];
      userNote?: string;
    } | null;
    const question = String(body?.question ?? "").trim().slice(0, 1000);
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
    const chapters = found.note.chapters ?? [];
    const chapterIndex = chapters.findIndex(
      (c) => String(c.id) === String(chapterId)
    );
    if (chapterIndex === -1) {
      return NextResponse.json(
        { error: "Bab tidak ditemukan." },
        { status: 404 }
      );
    }

    const chapter = chapters[chapterIndex];
    const prev = chapterIndex > 0 ? chapters[chapterIndex - 1] : null;
    const next =
      chapterIndex < chapters.length - 1 ? chapters[chapterIndex + 1] : null;
    const userNote = String(body?.userNote ?? "").trim().slice(0, 8000);

    const contextParts = [
      `JUDUL BAB: ${chapter.title}`,
      `ISI BAB:\n${String(chapter.content ?? "").slice(0, 20000)}`,
    ];
    if (prev) contextParts.push(`(Bab sebelumnya: "${prev.title}")`);
    if (next) contextParts.push(`(Bab berikutnya: "${next.title}")`);
    if (userNote) {
      contextParts.push(
        `CATATAN PRIBADI SISWA UNTUK BAB INI:\n${userNote.slice(0, 4000)}`
      );
    }

    const messages: ChatTurn[] = Array.isArray(body?.messages)
      ? body.messages
          .filter(
            (m) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string" &&
              m.content.trim().length > 0
          )
          .slice(-8)
      : [];

    const historyText =
      messages.length > 0
        ? `\n\nPERCAKAPAN SEBELUMNYA (jawab lanjutan dari percakapan ini):\n${messages
            .map((m) => `${m.role === "user" ? "Siswa" : "Asisten"}: ${m.content}`)
            .join("\n")}`
        : "";

    const answer = await aiChat({
      system:
        "Kamu adalah asisten belajar Eureka.AI yang ramah dan sabar. Jawab pertanyaan HANYA berdasarkan isi BAB yang diberikan, dalam bahasa Indonesia yang jelas, terstruktur, dan mudah dipahami. Jika jawaban tidak ada di isi bab, katakan dengan jujur bahwa hal itu tidak dibahas di bab ini, lalu beri petunjuk di mana mungkin bisa ditemukan (bab lain, atau sarankan tanya materi lain).",
      user: `KONTEKS MATERI (catatan "${found.note.title}", bab ${chapterIndex + 1} dari ${chapters.length}):\n\n${contextParts.join(
        "\n\n---\n\n"
      ).slice(0, 26000)}${historyText}\n\nPERTANYAAN SISWA:\n${question}`,
      maxTokens: 1200,
      temperature: 0.4,
    });

    return NextResponse.json({ answer: answer.trim() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal menjawab pertanyaan.";
    console.error("[api/notes/[id]/bab/[chapterId]/ask]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
