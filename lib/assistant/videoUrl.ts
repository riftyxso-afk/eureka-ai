/**
 * Deteksi link YouTube di teks — murni (tanpa I/O), aman dipakai di klien
 * (render embed) maupun server (video aktif sesi).
 *
 * Sengaja TIDAK import dari lib/rag/extract.ts karena modul itu memuat
 * builtin Node (fs/os/path) yang tidak bisa masuk bundle client component.
 * Pola regex di sini disalin dari extractYoutubeId agar hasilnya sama.
 */

const YOUTUBE_ID_PATTERNS = [
  /youtu\.be\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
];

/** Ekstrak ID video dari satu URL. Null bila bukan link YouTube valid. */
export function extractYoutubeVideoId(url: string): string | null {
  for (const p of YOUTUBE_ID_PATTERNS) {
    const m = String(url ?? "").match(p);
    if (m) return m[1];
  }
  return null;
}

export interface YoutubeLink {
  /** URL asli yang ditulis user (dibersihkan tanda baca di ujung). */
  url: string;
  /** ID video 11 karakter. */
  videoId: string;
}

const URL_TOKEN_RE = /https?:\/\/[^\s<>"']+/gi;

/**
 * Link YouTube PERTAMA yang ditemukan dalam teks (bisa berupa satu kalimat
 * atau seluruh isi pesan). Null bila tidak ada.
 */
export function findYoutubeLink(text: string): YoutubeLink | null {
  const src = String(text ?? "");
  URL_TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = URL_TOKEN_RE.exec(src)) !== null) {
    const url = m[0].replace(/[.,;:!?)\]]+$/, "");
    const videoId = extractYoutubeVideoId(url);
    if (videoId) return { url, videoId };
  }
  return null;
}

/**
 * Video aktif sesi: link YouTube TERBARU di pesan-pesan USER (pesan asisten
 * dilewati). Dipakai server untuk turn-turn lanjutan setelah link dikirim.
 */
export function findLatestYoutubeInUserMessages(
  messages: { role: string; content: string }[]
): string | null {
  for (const m of [...(messages ?? [])].reverse()) {
    if (m.role !== "user") continue;
    const link = findYoutubeLink(m.content);
    if (link) return link.url;
  }
  return null;
}
