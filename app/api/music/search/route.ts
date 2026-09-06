/**
 * GET /api/music/search?q=… — pencarian video YouTube (music-hub).
 *
 * Tanpa API key: scrape halaman hasil YouTube (ytInitialData JSON di HTML)
 * lalu ekstrak item videoRenderer (id, judul, channel, durasi, thumbnail).
 *
 * Respon: { videos: MusicVideo[] }
 */
import { NextRequest, NextResponse } from "next/server";

import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";
import type { MusicVideo } from "@/lib/music";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface VideoRenderer {
  videoId?: string;
  title?: { runs?: { text: string }[]; simpleText?: string };
  longBylineText?: { runs?: { text: string }[] };
  ownerText?: { runs?: { text: string }[] };
  lengthText?: { simpleText?: string; runs?: { text: string }[] };
  thumbnail?: { thumbnails?: { url: string }[] };
}

function extractText(node: VideoRenderer["title"] | VideoRenderer["ownerText"] | VideoRenderer["longBylineText"] | VideoRenderer["lengthText"]): string {
  if (!node) return "";
  if ("simpleText" in node && node.simpleText) return node.simpleText;
  if (node.runs && Array.isArray(node.runs)) return node.runs.map((r) => r.text).join("");
  return "";
}

/** Rekursif kumpulkan semua object ber-key videoRenderer. */
function collectVideoRenderers(node: unknown, out: VideoRenderer[], depth = 0): void {
  if (depth > 12 || node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectVideoRenderers(item, out, depth + 1);
    return;
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (obj.videoRenderer && typeof obj.videoRenderer === "object") {
      out.push(obj.videoRenderer as VideoRenderer);
    }
    for (const v of Object.values(obj)) collectVideoRenderers(v, out, depth + 1);
  }
}

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (!q) {
      return NextResponse.json({ error: "Query pencarian diperlukan." }, { status: 400 });
    }
    if (q.length > 200) {
      return NextResponse.json({ error: "Query terlalu panjang." }, { status: 400 });
    }

    ensureRateLimitPrune();
    // Tanpa userId (halaman publik dalam dashboard); batasi per-IP sederhana via header.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
    const rl = checkRateLimit(`music-search:${ip}`, 40, 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak pencarian. Tunggu sebentar ya." },
        { status: 429 }
      );
    }

    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Gagal mencari di YouTube." }, { status: 502 });
    }
    const html = await res.text();

    // ytInitialData = {...};  — ekstrak JSON-nya.
    const m = html.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/);
    if (!m) {
      return NextResponse.json({ videos: [] });
    }
    let data: unknown;
    try {
      data = JSON.parse(m[1]);
    } catch {
      return NextResponse.json({ videos: [] });
    }

    const renderers: VideoRenderer[] = [];
    collectVideoRenderers(data, renderers);

    const videos: MusicVideo[] = renderers
      .filter((r) => r.videoId && extractText(r.title))
      .slice(0, 15)
      .map((r) => {
        const thumbs = r.thumbnail?.thumbnails ?? [];
        const thumb =
          thumbs.find((t) => t.url?.includes("mqdefault")) ?? thumbs[thumbs.length - 1];
        return {
          id: r.videoId as string,
          title: extractText(r.title),
          author: extractText(r.longBylineText) || extractText(r.ownerText),
          duration: extractText(r.lengthText),
          thumb: thumb?.url?.startsWith("//") ? `https:${thumb.url}` : thumb?.url,
          url: `https://www.youtube.com/watch?v=${r.videoId}`,
        };
      });

    return NextResponse.json({ videos });
  } catch (e) {
    console.error("[api/music/search]", e);
    return NextResponse.json({ error: "Gagal mencari video." }, { status: 500 });
  }
}
