import { NextRequest, NextResponse } from "next/server";

import { authorizeAssistantUser } from "@/lib/assistant/auth";
import { db } from "@/lib/supabase/admin";
import { transcribeAudioVideo } from "@/lib/rag/extract";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * POST /api/audio/transcribe
 * FormData: { userId: string, audio: Blob }
 * Transkripsi rekaman suara (beta tester) → teks.
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
    const bytes = Buffer.from(await audio.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { error: "Audio terlalu besar (maks 8 MB)." },
        { status: 413 }
      );
    }

    const filename =
      audio instanceof Blob && typeof (audio as { name?: unknown }).name === "string"
        ? String((audio as { name: string }).name)
        : `rekaman-${Date.now()}.webm`;
    const result = await transcribeAudioVideo(bytes, filename);

    if (!result.text.trim()) {
      return NextResponse.json(
        { error: "Tidak ada suara yang terdeteksi. Coba bicara lebih jelas." },
        { status: 422 }
      );
    }
    return NextResponse.json({ ok: true, text: result.text.trim() });
  } catch (e) {
    const msg = "Gagal mentranskripsi audio. Coba lagi ya.";
    console.error("[api/audio/transcribe] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
