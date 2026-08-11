import { NextRequest, NextResponse } from "next/server";

import { aiChat, hasAiKey } from "@/lib/ai";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `Kamu adalah Eureka, tutor belajar pribadi yang sabar menggunakan metode Socratic.
Bimbing siswa menemukan jawabannya sendiri lewat pertanyaan bertahap — jangan pernah langsung memberi jawaban final.
Gunakan bahasa Indonesia yang santai tapi cerdas. Maksimal 3–4 kalimat per balasan.
Kalau siswa menjawab benar atau menunjukkan pemahaman, hargai dan tulis "EUREKA! 🎉" lalu beri pertanyaan lanjutan yang sedikit lebih menantang.
Kalau siswa salah, jangan menghakimi; beri petunjuk kecil dan dorong dia mencoba lagi.
Sesekali gunakan contoh nyata supaya mudah dibayangkan.`;

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      messages?: ChatTurn[];
      topic?: string;
    } | null;

    const turns: ChatTurn[] = Array.isArray(body?.messages)
      ? body.messages.filter(
          (m) =>
            m &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string" &&
            m.content.trim().length > 0
        )
      : [];
    const topic = String(body?.topic ?? "").slice(0, 200);
    const history = turns.slice(-16);

    // Fallback offline bila API key AI belum diatur.
    if (!hasAiKey()) {
      return NextResponse.json({
        reply:
          "API key AI belum diatur. Isi OPENAGENTIC_API_KEY atau OPENROUTER_API_KEY di .env.local untuk mulai belajar bersama Eureka.",
      });
    }

    let userPrompt: string;
    if (history.length === 0) {
      userPrompt = topic
        ? `Mulai percakapan belajar tentang "${topic}" — ajukan SATU pertanyaan pembuka yang menantang tapi ramah kepada siswa baru.`
        : "Mulai percakapan belajar dengan SATU pertanyaan pembuka yang ramah dan menantang.";
    } else {
      const transcript = history
        .map((m) => `${m.role === "user" ? "Siswa" : "Eureka"}: ${m.content}`)
        .join("\n");
      userPrompt = `Lanjutkan percakapan ini:\n\n${transcript}\n\nSekarang giliranmu membimbing siswa.`;
    }

    const raw = await aiChat({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: 512,
      temperature: 0.8,
    });
    const reply = raw.trim();
    return NextResponse.json({ reply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal memanggil AI.";
    console.error("[api/chat]", e);
    return NextResponse.json(
      { error: msg, reply: "Hmm, AI-nya lagi sibuk. Coba tanya lagi ya 🙏" },
      { status: 500 }
    );
  }
}