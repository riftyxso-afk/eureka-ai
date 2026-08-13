/**
 * Rate limiter sederhana (sliding window, in-memory) untuk melindungi
 * penggunaan AI agar token/kuota tidak cepat habis.
 *
 * Catatan deployment:
 * - In-memory = kuat di backend VPS (satu proses). Di Vercel (serverless)
 *   limit berlaku per instance lambda — tetap menangkap penyalahgunaan cepat
 *   dari satu user; perlindungan lintas instance ditangani oleh kapasitas
 *   global (lihat lib/jobQueue: canStartGeneration).
 */

export interface RateLimitResult {
  ok: boolean;
  /** Berapa ms lagi boleh mencoba (untuk header Retry-After). */
  retryAfterMs: number;
  /** Berapa permintaan tersisa di jendela berjalan (untuk header). */
  remaining: number;
}

const buckets = new Map<string, number[]>();

/**
 * Cek + catat satu permintaan untuk key di jendela waktu.
 * @param key mis. `note-process:${userId}`.
 * @param max jumlah maksimal permintaan dalam windowMs.
 * @param windowMs panjang jendela (ms).
 */
export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const list = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (list.length >= max) {
    buckets.set(key, list);
    const retryAfterMs = Math.max(0, list[0] + windowMs - now);
    return { ok: false, retryAfterMs, remaining: 0 };
  }

  list.push(now);
  buckets.set(key, list);
  return { ok: true, retryAfterMs: 0, remaining: max - list.length };
}

/** Bersihkan bucket yang sudah tidak dipakai (dipanggil berkala / opsional). */
export function pruneRateLimits(olderThanMs = 2 * 60 * 60 * 1000): void {
  const cutoff = Date.now() - olderThanMs;
  for (const [key, list] of buckets) {
    if (list.length === 0 || list[list.length - 1] < cutoff) {
      buckets.delete(key);
    }
  }
}

/** Jalankan pembersihan sekali per proses (aman dipanggil berulang). */
let pruned = false;
export function ensureRateLimitPrune(): void {
  if (pruned) return;
  pruned = true;
  setInterval(() => pruneRateLimits(), 10 * 60 * 1000).unref?.();
}
