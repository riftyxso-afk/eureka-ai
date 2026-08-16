import { NextRequest, NextResponse } from "next/server";

import { aiChat, hasAiKey } from "@/lib/ai";
import { authorizeAssistantUser } from "@/lib/assistant/auth";
import { db } from "@/lib/supabase/admin";
import { AI_SAFETY_GUARDRAIL } from "@/lib/prompts/safety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VOICE_SYSTEM = `Kamu adalah Eureka, tutor suara yang ramah dan sabar (metode Socratic).
Bimbing siswa lewat pertanyaan bertahap — jangan langsung memberi jawaban final.
Bahasa Indonesia santai tapi cerdas. Jawaban maksimal 3–4 kalimat karena ini percakapan SUARA (dibacakan text-to-speech) — singkat, padat, jelas.
Tulis "EUREKA! 🎉" saat siswa menunjukkan pemahaman, lalu beri pertanyaan lanjutan yang sedikit lebih menantang.
Saat siswa salah, jangan menghakimi — beri petunjuk kecil dan dorong dia mencoba lagi.
Sesekali gunakan contoh nyata agar mudah dibayangkan.`;

/**
 * POST /api/call
 * Body: { userId: string, question: string }
 * Jawaban singkat untuk percakapan suara (beta tester) — dibacakan TTS.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      userId?: unknown;
      question?: unknown;
    } | null;
    const rawUserId = String(body?.userId ?? "").trim();
    const question = String(body?.question ?? "").trim().slice(0, 2000);

    const auth = await authorizeAssistantUser(
      req.headers.get("authorization"),
      rawUserId
    );
    if (!auth.userId) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status ?? 401 }
      );
    }

    // Hanya beta tester.
    const { data: user } = await db()
      .from("users")
      .select("is_beta")
      .eq("id", auth.userId)
      .maybeSingle();
    if (user?.is_beta !== true) {
      return NextResponse.json(
        { error: "Fitur ini khusus beta tester. Gabung lewat /join dulu ya." },
        { status: 403 }
      );
    }

    if (!question) {
      return NextResponse.json(
        { error: "Pertanyaan kosong." },
        { status: 400 }
      );
    }

    if (!hasAiKey()) {
      return NextResponse.json(
        {
          reply:
            "API key AI belum diatur. Isi OPENAGENTIC_API_KEY di .env.local dulu ya.",
        },
        { status: 200 }
      );
    }

    const raw = await aiChat({
      system: `${VOICE_SYSTEM}\n\n${AI_SAFETY_GUARDRAIL}`,
      user: question,
      maxTokens: 400,
      temperature: 0.8,
      speedMode: "fast",
    });
    const reply = raw.trim();
    if (!reply) {
      return NextResponse.json(
        { error: "AI tidak menjawab. Coba lagi ya 🙏" },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, reply });
  } catch (e) {
    const msg = "Gagal memanggil AI suara. Coba lagi ya.";
    console.error("[api/call] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
