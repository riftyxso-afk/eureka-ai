import { NextRequest, NextResponse } from "next/server";

import { hasAiKey } from "@/lib/ai";
import {
  authorizeAssistantUser,
  isBetaTester,
} from "@/lib/assistant/auth";
import { extractYoutubeVideoId } from "@/lib/assistant/videoUrl";
import { languageFromRequest } from "@/lib/locale";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";
import { getVideoPoints, videoPointsCache } from "@/lib/videoPoints";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/video/points — poin-poin isi video YouTube (panel "View").
 * Generate AI dari transkrip; hasil di-cache per video agar buka/tutup panel
 * tidak memanggil AI ulang. Hanya pemilik sesi (token Supabase) yang bisa.
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

    // Cache hit → langsung tanpa rate limit & tanpa AI (murni baca memori).
    const videoId = extractYoutubeVideoId(url);
    if (videoId) {
      const cached = videoPointsCache.get(videoId);
      if (cached) {
        return NextResponse.json({
          points: cached,
          source: "ai",
          cached: true,
        });
      }
    }

    // Proteksi token AI: maks 15 generate poin per user per jam.
    ensureRateLimitPrune();
    const rl = checkRateLimit(`video-points:${auth.userId}`, 15, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan. Tunggu sebentar ya." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
        }
      );
    }

    if (!hasAiKey()) {
      return NextResponse.json(
        { error: "API key AI belum diatur di .env.local." },
        { status: 400 }
      );
    }

    const result = await getVideoPoints(url, languageFromRequest(req));
    if ("error" in result) {
      if (result.error === "no-transcript") {
        return NextResponse.json(
          { error: "Transkrip video tidak tersedia — poin tidak bisa dibuat." },
          { status: 422 }
        );
      }
      return NextResponse.json(
        { error: "AI gagal membuat poin. Coba lagi." },
        { status: 500 }
      );
    }
    return NextResponse.json(result);
  } catch (e) {
    const msg = "Gagal membuat poin video.";
    console.error("[api/video/points] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
