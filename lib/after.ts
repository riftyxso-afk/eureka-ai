import { after as nextAfter } from "next/server";

/**
 * Jalankan kerja setelah respons HTTP selesai.
 *
 * Di runtime Next.js memakai `after()` native (Vercel & self-hosted).
 * Di luar runtime Next (mis. backend server mandiri di folder /backend),
 * `after()` melempar error saat dipanggil → fallback ke setImmediate
 * agar route yang sama tetap berjalan tanpa modifikasi.
 */
export function runAfter(fn: () => void): void {
  try {
    nextAfter(fn);
  } catch {
    setImmediate(fn);
  }
}
