/**
 * Poin-poin isi video untuk panel "View" (change video-expand-key-points).
 *
 * Bagian parse & cache sengaja MURNI (tanpa import di level modul) agar bisa
 * diuji node:test tanpa jaringan. I/O (scrape transkrip & panggil AI) dipakai
 * lewat dynamic import di getVideoPoints, jadi modul ini tetap bisa di-import
 * oleh test tanpa menarik lib server-only.
 */

export const VIDEO_POINTS_TTL_MS = 60 * 60 * 1000; // 1 jam
export const MAX_POINTS = 8;

/**
 * Parsing jawaban AI → daftar poin.
 * Strip awalan bullet ("- ", "• ", "* ", nomor "1. "), buang baris kosong,
 * dedupe, dan batasi maks `max` poin.
 */
export function parsePoints(raw: string, max: number = MAX_POINTS): string[] {
  const seen = new Set<string>();
  const points: string[] = [];
  for (const line of String(raw ?? "").split(/\r?\n/)) {
    const cleaned = line
      .trim()
      .replace(/^[-•*]\s*/, "")
      .replace(/^\d+[.)]\s*/, "")
      .trim();
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    points.push(cleaned);
    if (points.length >= max) break;
  }
  return points;
}

export interface CachedPoints {
  points: string[];
  fetchedAt: number;
}

/**
 * Cache in-memory per videoId dengan TTL. Jam bisa di-inject (untuk pengujian).
 * Entry yang kedaluwarsa dihapus dan diperlakukan sebagai miss.
 */
export class VideoPointsCache {
  private store = new Map<string, CachedPoints>();
  private ttlMs: number;
  private now: () => number;

  constructor(
    ttlMs: number = VIDEO_POINTS_TTL_MS,
    now: () => number = () => Date.now()
  ) {
    this.ttlMs = ttlMs;
    this.now = now;
  }

  get(videoId: string): string[] | null {
    const entry = this.store.get(videoId);
    if (!entry) return null;
    if (this.now() - entry.fetchedAt > this.ttlMs) {
      this.store.delete(videoId);
      return null;
    }
    return entry.points;
  }

  set(videoId: string, points: string[]): void {
    this.store.set(videoId, { points, fetchedAt: this.now() });
  }
}

/** Cache global (per instance server). */
export const videoPointsCache = new VideoPointsCache();

export interface VideoPointsResult {
  points: string[];
  source: "ai";
  cached: boolean;
}

export type VideoPointsError = { error: "invalid-url" | "no-transcript" | "ai-failed" };

/**
 * Generate poin penting video dari transkrip (cache dulu, generate hanya saat
 * miss). Server-only: scrape transkrip & panggilan AI lewat dynamic import.
 * `language` mengikuti locale user ("Bahasa Indonesia" | "English").
 */
export async function getVideoPoints(
  url: string,
  language: string = "Bahasa Indonesia"
): Promise<VideoPointsResult | VideoPointsError> {
  const { extractYoutubeVideoId } = await import("@/lib/assistant/videoUrl");
  const videoId = extractYoutubeVideoId(url);
  if (!videoId) return { error: "invalid-url" };

  const cached = videoPointsCache.get(videoId);
  if (cached) return { points: cached, source: "ai", cached: true };

  const { scrapeYoutubeTranscript } = await import("@/lib/rag/extract");
  const { aiChat } = await import("@/lib/ai");

  let extracted;
  try {
    extracted = await scrapeYoutubeTranscript(url);
  } catch (e) {
    // Tidak ada subtitle / subtitle kosong / gagal ekstrak → poin tak bisa dibuat.
    console.warn("[videoPoints] transkrip tidak tersedia:", e);
    return { error: "no-transcript" };
  }

  const isEnglish = language === "English";
  const transcript = extracted.text.slice(0, 20000);
  const raw = await aiChat({
    system: isEnglish
      ? "You summarize YouTube videos into study points for students. Reply ONLY with a bullet list — one point per line starting with '- '. Use clear, friendly English. No introduction and no closing."
      : "Kamu meringkas video YouTube menjadi poin-poin belajar untuk siswa. Jawab HANYA daftar poin — satu poin per baris diawali '- '. Gunakan bahasa Indonesia yang santai tapi jelas. Tanpa pendahuluan dan tanpa penutup.",
    user: isEnglish
      ? `Create 5-8 key points from the following video transcript:\n\n${transcript}`
      : `Buat 5-8 poin penting dari transkrip video berikut:\n\n${transcript}`,
    maxTokens: 600,
    temperature: 0.4,
  });

  const points = parsePoints(raw);
  if (points.length === 0) return { error: "ai-failed" };
  videoPointsCache.set(videoId, points);
  return { points, source: "ai", cached: false };
}
