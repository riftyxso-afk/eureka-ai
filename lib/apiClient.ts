/**
 * Klien API terpusat untuk frontend.
 *
 * Semua panggilan API dari komponen/halaman lewat sini.
 * Backend berjalan terpisah (Hono di port 3001 atau URL production).
 *
 * Env:
 * - NEXT_PUBLIC_API_URL: URL backend (mis. "https://api.eureka-ai.web.id")
 *   Kosongkan saat dev → otomatis pakai http://localhost:3001
 */

import { getAccessToken } from "./supabase/client";

/**
 * Fallback URL backend untuk production bila NEXT_PUBLIC_API_URL tidak di-set
 * saat build. Sesuaikan dengan domain backend kamu (mis. "https://api-eureka.web.id").
 */
const PRODUCTION_API_FALLBACK = "https://api-eureka.web.id";

/** URL dasar backend API */
function getApiBase(): string {
  const envUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
  if (envUrl) return envUrl;

  // Default: backend di port 3001 saat development
  if (typeof window !== "undefined") {
    // Di browser: gunakan origin yang sama atau localhost:3001
    const origin = window.location.origin;
    if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
      return "http://localhost:3001";
    }
    // Production tanpa env: pakai fallback backend supaya frontend & backend
    // tetap terhubung (kalau fallback kosong, dipakai same-origin).
    if (PRODUCTION_API_FALLBACK) return PRODUCTION_API_FALLBACK;
    console.warn(
      "[apiClient] NEXT_PUBLIC_API_URL belum di-set dan PRODUCTION_API_FALLBACK kosong — " +
        "semua panggilan memakai same-origin (bukan backend terpisah). " +
        "Atur NEXT_PUBLIC_API_URL di Vercel (Settings → Environment Variables) lalu Redeploy."
    );
  }
  // Fallback: same-origin (akan redirect ke backend via reverse proxy)
  return "";
}

const API_BASE = getApiBase();

/** Susun URL API absolut dari path API. */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

/** fetch ke endpoint API backend. */
export async function apiFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);
  // Lampirkan token sesi (bila ada) agar backend bisa memverifikasi user.
  const token = await getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // Kirim locale aktif (id/en) — backend memakai ini untuk memilih bahasa
  // konten AI (catatan, kuis, flashcards, jawaban chat).
  const locale = getClientLocale();
  if (locale) headers.set("x-locale", locale);
  return fetch(apiUrl(path), { ...init, headers });
}

/** Baca locale aktif dari cookie (diset middleware / LocaleContext). */
export function getClientLocale(): string {
  if (typeof window === "undefined") return "";
  try {
    const m = document.cookie.match(/(?:^|;\s*)eureka_locale=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  } catch {
    return "";
  }
}

/** EventSource ke endpoint SSE API backend. */
export function apiEventSource(path: string): EventSource {
  return new EventSource(apiUrl(path));
}
