/**
 * Middleware i18n — deteksi bahasa berdasarkan IP/geo + URL ber-prefix locale.
 *
 * Alur:
 * - /en/pricing (atau /id/...)  → rewrite ke /pricing + header `x-locale`
 *   (folder halaman TIDAK dipindah; link internal lama tetap aman).
 * - /pricing (tanpa prefix)     → redirect 307 ke /{locale}/pricing.
 *   Locale dipilih: cookie eureka_locale > geo (Vercel: IP → negara) > id.
 * - /api, /_next, dan file statis (favicon, robots, sitemap, dll.) dilewati.
 *
 * Di Vercel, `request.geo.country` berasal dari IP request sehingga user
 * dari luar Indonesia otomatis mendapat /en/... — persis permintaan.
 */
import { NextResponse, type NextRequest } from "next/server";
import { isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

const LOCALE_COOKIE = "eureka_locale";
const LOCALE_PREFIX_RE = /^\/(id|en)(\/|$)/;

/** Tentukan locale: cookie > geo negara (Vercel) > default id. */
function resolveLocale(req: NextRequest): Locale {
  const cookie = req.cookies.get(LOCALE_COOKIE)?.value;
  if (cookie && isLocale(cookie)) return cookie;
  // Vercel menyediakan geo dari IP (hanya di edge middleware). Tipe
  // NextRequest Next 16 belum memuat `geo` — akses via cast aman.
  const geo = (req as NextRequest & { geo?: { country?: string | null } }).geo;
  const country = geo?.country;
  if (country === "ID") return "id";
  if (country) return "en";
  return DEFAULT_LOCALE;
}

const MAINTENANCE_MODE = false; // Ubah ke true untuk menonaktifkan mode pemeliharaan

export function middleware(req: NextRequest) {
  const { pathname, search, hash } = req.nextUrl;

  // ── MODE PEMELIHARAAN ──
  // Block semua halaman. Hanya izinkan:
  //  - /maintenance (halaman pemeliharaan itu sendiri)
  //  - /_next (aset internal Next.js — CSS, JS, font, gambar)
  //  - file statis yang mengandung titik (favicon.ico, robots.txt, dll)
  //  - /api (backend VPS — tetap hidup supaya bisa dimatikan manual di sana)
  if (MAINTENANCE_MODE) {
    const isMaintenancePage =
      pathname === "/maintenance" || pathname === "/en/maintenance" || pathname === "/id/maintenance";
    const isNextInternal = pathname.startsWith("/_next");
    const isStaticFile = pathname.includes("."); // favicon.ico, robots.txt, banner.png, dll
    const isApi = pathname.startsWith("/api");

    if (!isMaintenancePage && !isNextInternal && !isStaticFile && !isApi) {
      const url = req.nextUrl.clone();
      url.pathname = "/maintenance";
      return NextResponse.redirect(url, 302);
    }
  }

  const match = pathname.match(LOCALE_PREFIX_RE);

  // ── Path sudah ber-prefix locale: rewrite ke path asli + header ──
  if (match) {
    const locale = match[1] as Locale;
    const rest = match[2] ? pathname.slice(3) : "/";
    const url = req.nextUrl.clone();
    url.pathname = rest || "/";
    const res = NextResponse.rewrite(url);
    res.headers.set("x-locale", locale);
    res.headers.set("x-locale-path", pathname);
    res.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return res;
  }

  // ── Tanpa prefix: redirect ke /{locale}{path} ──
  const locale = resolveLocale(req);
  const url = req.nextUrl.clone();
  url.pathname = pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;
  // search & hash sudah ikut terbawa (clone mempertahankan query).
  const res = NextResponse.redirect(url, 307);
  res.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}

export const config = {
  // Lewati /api (backend Hono/VPS), /_next (internal Next), dan semua
  // file statis (berisi titik: favicon.ico, robots.txt, sitemap.xml, dll).
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
