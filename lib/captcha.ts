/**
 * CAPTCHA — Cloudflare Turnstile.
 *
 * Cara setup (sekali saja):
 *   1. Daftar di https://dash.cloudflare.com/sign-up → Turnstile (gratis).
 *   2. Tambahkan situs → dapatkan Site Key & Secret Key.
 *   3. Isi di .env.local (dan Vercel/VPS):
 *        NEXT_PUBLIC_TURNSTILE_SITE_KEY = "0x4AAA..."   (public — aman di frontend)
 *        TURNSTILE_SECRET_KEY           = "0x4AAA..."   (rahasia — server saja)
 *
 * Bila key belum diisi, verifikasi dilewati (mode dev/demo) — halaman tetap
 * bisa dipakai, tapi tanpa perlindungan captcha.
 */

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Secret key server-side (jangan pernah di-expose ke client). */
export function getTurnstileSecretKey(): string {
  return process.env.TURNSTILE_SECRET_KEY ?? "";
}

/** Site key public (aman dibaca client, di-inline saat build). */
export function getTurnstileSiteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
}

/** True bila site key (public) tersedia — dipakai client untuk mengaktifkan widget. */
export function isTurnstileClientConfigured(): boolean {
  const site = getTurnstileSiteKey();
  return site.length > 10 && !site.includes("xxx");
}

/** True bila Turnstile dikonfigurasi penuh (site key + secret key asli). */
export function isTurnstileConfigured(): boolean {
  const secret = getTurnstileSecretKey();
  const site = getTurnstileSiteKey();
  return (
    site.length > 10 &&
    !site.includes("xxx") &&
    secret.length > 10 &&
    !secret.includes("xxx")
  );
}

/**
 * Verifikasi token Turnstile dari client.
 * - Bila Turnstile belum dikonfigurasi → dianggap lolos (mode dev/demo).
 * - Bila dikonfigurasi tapi token kosong/salah → gagal (penolakan nyata).
 */
export async function verifyTurnstileToken(
  token: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isTurnstileConfigured()) {
    return { ok: true };
  }
  const clean = String(token ?? "").trim();
  if (!clean) {
    return { ok: false, error: "Selesaikan verifikasi keamanan dulu ya." };
  }
  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: getTurnstileSecretKey(),
        response: clean,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const data = (await res.json().catch(() => null)) as {
      success?: boolean;
      "error-codes"?: string[];
    } | null;
    if (data?.success === true) return { ok: true };
    const codes = Array.isArray(data?.["error-codes"])
      ? data!["error-codes"]!.join(", ")
      : "Token tidak valid.";
    return { ok: false, error: `Verifikasi keamanan gagal (${codes}). Coba lagi.` };
  } catch {
    return { ok: false, error: "Gagal memverifikasi keamanan. Periksa koneksi." };
  }
}
