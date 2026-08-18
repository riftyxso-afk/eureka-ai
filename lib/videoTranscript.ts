/**
 * Transkrip bertimestamp untuk panel subtitle sinkron di overlay View
 * (change video-expand-subtitles).
 *
 * Cache & logika segmen aktif sengaja MURNI (tanpa import di level modul)
 * agar bisa diuji node:test tanpa jaringan. I/O (scrape subtitle YouTube)
 * dipakai lewat dynamic import di getVideoTranscript.
 */

export const VIDEO_TRANSCRIPT_TTL_MS = 60 * 60 * 1000; // 1 jam
export const MAX_TRANSCRIPT_SEGMENTS = 2000;

// Tipe & helper murni yang dipakai client didefinisikan di modul client-safe
// (lib/videoTranscriptShared.ts) agar webpack/turbopack tidak menarik
// lib/rag/extract (server-only) ke bundle client. Import + re-export di sini
// demi satu sumber kebenaran.
import type { VideoTranscriptSegment } from "./videoTranscriptShared.ts";
export type { VideoTranscriptSegment } from "./videoTranscriptShared.ts";
export { activeSegmentIndex } from "./videoTranscriptShared.ts";

export interface VideoTranscriptData {
  title: string;
  segments: VideoTranscriptSegment[];
}

export interface CachedTranscript {
  data: VideoTranscriptData;
  fetchedAt: number;
}

/**
 * Cache in-memory per videoId dengan TTL. Jam bisa di-inject (untuk pengujian).
 * Entry yang kedaluwarsa dihapus dan diperlakukan sebagai miss.
 */
export class TranscriptCache {
  private store = new Map<string, CachedTranscript>();
  private ttlMs: number;
  private now: () => number;

  constructor(
    ttlMs: number = VIDEO_TRANSCRIPT_TTL_MS,
    now: () => number = () => Date.now()
  ) {
    this.ttlMs = ttlMs;
    this.now = now;
  }

  get(videoId: string): VideoTranscriptData | null {
    const entry = this.store.get(videoId);
    if (!entry) return null;
    if (this.now() - entry.fetchedAt > this.ttlMs) {
      this.store.delete(videoId);
      return null;
    }
    return entry.data;
  }

  set(videoId: string, data: VideoTranscriptData): void {
    this.store.set(videoId, { data, fetchedAt: this.now() });
  }
}

/** Cache global (per instance server). */
export const videoTranscriptCache = new TranscriptCache();

/**
 * Bersihkan segmen mentah dari ekstraktor: buang teks kosong/whitespace,
 * pastikan `durationMs` angka (default 0), dan batasi maks jumlah segmen.
 * Murni agar bisa diuji tanpa jaringan.
 */
export function sanitizeSegments(
  segments: readonly {
    text: string;
    offsetMs: number;
    durationMs?: number;
  }[]
): VideoTranscriptSegment[] {
  return segments
    .filter((s) => s.text.trim().length > 0)
    .slice(0, MAX_TRANSCRIPT_SEGMENTS)
    .map((s) => ({
      text: s.text,
      offsetMs: s.offsetMs,
      durationMs: s.durationMs ?? 0,
    }));
}



export type VideoTranscriptError = { error: "invalid-url" | "no-transcript" };

/**
 * Ambil transkrip bertimestamp video YouTube (cache dulu, scrape hanya saat
 * miss). Server-only: scrape lewat dynamic import.
 */
export async function getVideoTranscript(
  url: string
): Promise<VideoTranscriptData | VideoTranscriptError> {
  const { extractYoutubeVideoId } = await import("@/lib/assistant/videoUrl");
  const videoId = extractYoutubeVideoId(url);
  if (!videoId) return { error: "invalid-url" };

  const cached = videoTranscriptCache.get(videoId);
  if (cached) return cached;

  const { scrapeYoutubeTranscript } = await import("@/lib/rag/extract");

  let extracted;
  try {
    extracted = await scrapeYoutubeTranscript(url);
  } catch (e) {
    console.warn("[videoTranscript] subtitle tidak tersedia:", e);
    return { error: "no-transcript" };
  }

  const segments = sanitizeSegments(extracted.segments ?? []);

  if (segments.length === 0) return { error: "no-transcript" };

  const data: VideoTranscriptData = { title: extracted.title, segments };
  videoTranscriptCache.set(videoId, data);
  return data;
}
