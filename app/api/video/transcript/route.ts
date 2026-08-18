import { NextRequest, NextResponse } from "next/server";

import {
  authorizeAssistantUser,
  isBetaTester,
} from "@/lib/assistant/auth";
import { extractYoutubeVideoId } from "@/lib/assistant/videoUrl";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";
import {
  getVideoTranscript,
  videoTranscriptCache,
} from "@/lib/videoTranscript";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/video/transcript — subtitle bertimestamp video YouTube (panel
 * subtitle sinkron di overlay View). Hasil di-cache per video agar membuka
 * ulang overlay tidak memanggil YouTube berulang. Tanpa API key AI.
 * Hanya pemilik sesi (token Supabase) yang bisa.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      url?: string;
      userId?: string;
    } | null;
    const url = String(body?.url ?? "").trim().slice(0, 500);
    const rawUserId = String(body?.userId ?? "").trim();
    if (!url || !rawUserId) {
      return NextResponse.json(
        { error: "url dan userId diperlukan." },
        { status: 400 }
      );
    }
    if (!extractYoutubeVideoId(url)) {
      return NextResponse.json(
        { error: "Link YouTube tidak valid." },
        { status: 400 }
      );
    }

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

    // Fitur video hanya untuk beta tester (akses lewat /join).
    if (!(await isBetaTester(auth.userId))) {
      return NextResponse.json(
        { error: "Fitur ini khusus beta tester. Gabung lewat /join dulu ya." },
        { status: 403 }
      );
    }

    // Cache hit → langsung tanpa rate limit (murni baca memori).
    const videoId = extractYoutubeVideoId(url);
    if (videoId) {
      const cached = videoTranscriptCache.get(videoId);
      if (cached) {
        return NextResponse.json({
          title: cached.title,
          segments: cached.segments,
          cached: true,
        });
      }
    }

    // Guardrail ringan: maks 30 pengambilan transkrip per user per jam
    // (hanya hitung saat miss — proteksi biaya scraping YouTube).
    ensureRateLimitPrune();
    const rl = checkRateLimit(`video-transcript:${auth.userId}`, 30, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan. Tunggu sebentar ya." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
        }
      );
    }

    const result = await getVideoTranscript(url);
    if ("error" in result) {
      if (result.error === "no-transcript") {
        return NextResponse.json(
          { error: "Video ini tidak memiliki subtitle yang bisa diambil." },
          { status: 422 }
        );
      }
      return NextResponse.json(
        { error: "Link YouTube tidak valid." },
        { status: 400 }
      );
    }
    return NextResponse.json({
      title: result.title,
      segments: result.segments,
      cached: false,
    });
  } catch (e) {
    const msg = "Gagal mengambil subtitle video.";
    console.error("[api/video/transcript] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
