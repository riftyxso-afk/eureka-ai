/**
 * Deteksi permintaan "buat gambar" dari prompt chat (/home & /chat).
 *
 * Contoh yang dikenali:
 *   - "buatkan gambar sel hewan"
 *   - "buat gambar tentang fotosintesis"
 *   - "gambarin rumus gaya gravitasi"
 *   - "tolong buatkan saya gambar peta Indonesia"
 *
 * Deskripsi (sisa teks setelah kata perintah) diteruskan ke penyusun prompt
 * gambar; bila kosong ("buat gambar aja"), server memakai konteks percakapan
 * (topik yang sedang dibahas) supaya gambar TIDAK menyimpang ke topik lain.
 */

export interface ImageIntent {
  /** True bila prompt meminta pembuatan gambar. */
  isImageRequest: boolean;
  /** Deskripsi gambar yang diminta (bisa kosong = pakai konteks topik). */
  description: string;
  /** True bila permintaan gambar tanpa deskripsi (butuh konteks topik). */
  needsContext: boolean;
}

const VERB_RE =
  /(?:buat|buatkan|bikin|buatin|buatlah|generate|gambarkan|gambarin|gambar-kan|gambar-in|membuat|membuatkan)/i;

// 3 pola:
//  (1) kata kerja … kata gambar:  "buatkan gambar sel hewan", "generate ilustrasi X"
//  (2) shorthand GAMBAR saja:     "gambarin kucing", "gambarkan gunung"
//      (bukan "buatkan" — itu kata kerja umum: "buatkan contoh soal" ≠ gambar)
//  (3) "gambar tentang/mengenai <topik>"
const IMAGE_REQUEST_RE =
  /\b(?:buat|buatkan|bikin|buatin|buatlah|generate|gambarkan|gambarin|gambar-kan|gambar-in|membuat|membuatkan)\b[\s\S]{0,40}\b(?:gambar|ilustrasi|ilustrasikan|poster|logo|visual)\b|\b(?:gambarin|gambarkan|gambar-kan|gambar-in)\b\s+(?!tentang|mengenai)\S|\b(?:gambar|ilustrasi)\s+(?:tentang|mengenai)\b/i;

/** Bersihkan kata perintah → sisa teks jadi deskripsi gambar. */
function extractDescription(prompt: string): string {
  return prompt
    // Pembuka
    .replace(/^(?:tolong|minta|mohon|kak|bang|bro)\s+/i, "")
    // Kata kerja gambar
    .replace(/^(?:buat|buatkan|bikin|buatin|buatlah|generate|membuat|membuatkan|gambarkan|gambarin|gambar-kan|gambar-in)\s+/i, "")
    // Subjek
    .replace(/^(?:saya|aku|gue|kita|saya)\s+/i, "")
    // Kata "gambar/ilustrasi" + preposisi opsional
    .replace(/^(?:sebuah|satu|gambar|ilustrasi|ilustrasikan|poster|logo|visual)\s+(?:tentang|dari|mengenai)?\s*/i, "")
    // Penutup santai (bisa di awal string bila sisa hanya kata itu)
    .replace(/(?:^|\s+)(?:aja|saja|dong|ya|yah|nih|deh|dulu|dong)\s*$/i, "")
    .replace(/^[^a-zA-Z0-9]+/, "")
    .trim();
}

export function detectImageIntent(prompt: string): ImageIntent {
  const text = String(prompt ?? "").trim();
  const isImageRequest = IMAGE_REQUEST_RE.test(text);
  if (!isImageRequest) {
    return { isImageRequest: false, description: "", needsContext: false };
  }
  // Verifikasi ulang: harus ada kata kerja gambar ATAU "gambar tentang".
  const hasVerb = VERB_RE.test(text);
  const hasImageWord = /\b(?:gambar|ilustrasi|ilustrasikan|poster|logo|visual)\b/i.test(text);
  if (!hasVerb && !hasImageWord) {
    return { isImageRequest: false, description: "", needsContext: false };
  }
  const description = extractDescription(text);
  return {
    isImageRequest: true,
    description,
    needsContext: description.length === 0,
  };
}
