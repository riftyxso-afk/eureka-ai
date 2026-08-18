/**
 * Helper transkrip video yang AMAN untuk client (tanpa import server-only).
 * Dipakai panel subtitle di overlay View; modul server `lib/videoTranscript.ts`
 * re-export dari sini agar tidak menarik lib/rag/extract ke bundle client.
 */

export interface VideoTranscriptSegment {
  text: string;
  offsetMs: number;
  /** Durasi segmen dalam ms; 0 berarti tidak tersedia (fallback ke jarak antar segmen). */
  durationMs: number;
}

/**
 * Indeks segmen yang sedang aktif pada waktu `timeMs`.
 * Segmen aktif jika `offsetMs <= t < offsetMs + durasi`. Bila durasi tidak
 * tersedia (0), fallback ke jarak ke segmen berikutnya; segmen terakhir
 * dianggap aktif sampai waktu tak terbatas. Mengembalikan -1 bila tidak ada.
 */
export function activeSegmentIndex(
  segments: readonly VideoTranscriptSegment[],
  timeMs: number
): number {
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const start = s.offsetMs;
    const duration =
      s.durationMs > 0
        ? s.durationMs
        : i + 1 < segments.length
          ? segments[i + 1].offsetMs - start
          : Number.POSITIVE_INFINITY;
    if (timeMs >= start && timeMs < start + duration) return i;
  }
  return -1;
}
