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
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}

/** EventSource ke endpoint SSE API backend. */
export function apiEventSource(path: string): EventSource {
  return new EventSource(apiUrl(path));
}
