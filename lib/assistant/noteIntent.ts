/**
 * Deteksi permintaan "buat catatan" dari prompt chat (home & /chat/[id]).
 *
 * Saat user mengetik mis. "buat catatan tentang turunan" atau
 * "buatkan catatan dari https://youtube.com/...", alih-alih menjawab lewat
 * chat, prompt diteruskan ke pipeline pembuatan catatan (notes/process)
 * yang langsung di-generate AI dengan overlay progress.
 */

export interface NoteIntent {
  /** True bila prompt meminta pembuatan catatan. */
  isNoteRequest: boolean;
  /** URL yang ditemukan di prompt (YouTube/Web), bila ada. */
  url?: string;
  /** True bila URL adalah video YouTube. */
  isYoutube: boolean;
  /** Topik catatan (sisa teks setelah kata perintah) — untuk file teks. */
  topic: string;
}

const NOTE_REQUEST_RE =
  /(?:buat|buatkan|bikin|buatin|buatlah|generate|ringkas|rangkum)[^.\n]{0,40}(?:catatan|note)|\b(?:catatan|note)\s+(?:tentang|dari|mengenai)\b/i;

const URL_RE = /https?:\/\/[^\s]+/i;
const YOUTUBE_RE = /youtube\.com|youtu\.be/i;

/** Bersihkan kata perintah dari prompt → sisa teks jadi topik. */
function extractTopic(prompt: string, url?: string): string {
  let t = prompt;
  if (url) t = t.replace(url, "");
  t = t
    .replace(/^(?:buat|buatkan|bikin|buatin|buatlah|generate)\s+/i, "")
    .replace(/^(?:saya|aku|tolong|minta|mohon)\s+/i, "")
    .replace(/^(?:sebuah|satu)\s+(?:catatan|note)\s+(?:tentang|dari|mengenai)\s+/i, "")
    .replace(/^(?:catatan|note)\s+(?:tentang|dari|mengenai)\s+/i, "")
    .replace(/\s+(?:jadi\s+)?(?:catatan|note)\s*$/i, "")
    .replace(/^[^a-zA-Z0-9]+/, "")
    .trim();
  return t || prompt.trim();
}

export function detectNoteIntent(prompt: string): NoteIntent {
  const text = String(prompt ?? "").trim();
  const isNoteRequest = NOTE_REQUEST_RE.test(text);

  const urlMatch = URL_RE.exec(text);
  const url = urlMatch ? urlMatch[0].replace(/[.,;:!?]+$/, "") : undefined;
  const isYoutube = !!url && YOUTUBE_RE.test(url);

  return {
    isNoteRequest,
    url,
    isYoutube,
    topic: isNoteRequest ? extractTopic(text, url) : text,
  };
}
