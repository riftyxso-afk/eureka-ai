/**
 * Klien API terpusat untuk frontend.
 *
 * Semua panggilan API dari komponen/halaman lewat sini agar mudah dipindah
 * ke backend terpisah: cukup isi NEXT_PUBLIC_API_URL (mis.
 * "https://api.eureka-ai.web.id") di .env — tanpa mengubah satu pun call site.
 * Kosongkan (default) = API pada domain yang sama (same-origin).
 */
const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

/** Susun URL API absolut dari path API. */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

/** fetch ke endpoint API (sama seperti fetch biasa). */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}

/** EventSource ke endpoint SSE API. */
export function apiEventSource(path: string): EventSource {
  return new EventSource(apiUrl(path));
}
