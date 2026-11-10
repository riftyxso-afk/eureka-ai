import { NextRequest, NextResponse } from "next/server";

import { authorizeAssistantUser } from "@/lib/assistant/auth";
import { transcribeRecording, TranscriptionError } from "@/lib/audio/transcribe";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * POST /api/audio/transcribe
 * FormData: { userId: string, audio: Blob }
 * Transkripsi rekaman suara → teks untuk semua akun yang sudah login.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json(
        { error: "Form tidak valid." },
        { status: 400 }
      );
    }
    const rawUserId = String(form.get("userId") ?? "").trim();
    const audio = form.get("audio");

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

    // Rate limit: maks 20 transkripsi/jam per user.
    ensureRateLimitPrune();
    const rl = checkRateLimit(`transcribe:${auth.userId}`, 20, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu sering merekam. Tunggu sebentar ya." },
        { status: 429 }
      );
    }

    if (!(audio instanceof Blob)) {
      return NextResponse.json(
        { error: "File audio tidak ditemukan." },
        { status: 400 }
      );
    }
    if (audio.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Audio terlalu besar (maks 8 MB)." },
        { status: 413 }
      );
    }
    if (!audio.size || !/^(audio\/|video\/(webm|mp4))/i.test(audio.type)) {
      return NextResponse.json({ error: "Gunakan rekaman audio yang valid." }, { status: 400 });
    }

    const filename =
      audio instanceof Blob && typeof (audio as { name?: unknown }).name === "string"
        ? String((audio as { name: string }).name)
        : `rekaman-${Date.now()}.webm`;
    const language = req.headers.get("x-locale") === "en" ? "en" : "id";
    const text = await transcribeRecording(audio, filename, language);
    return NextResponse.json({ ok: true, text });
  } catch (e) {
    if (e instanceof TranscriptionError) return NextResponse.json({ error: e.message }, { status: e.status });
    const msg = "Gagal mentranskripsi audio. Coba lagi ya.";
    console.error("[api/audio/transcribe] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
