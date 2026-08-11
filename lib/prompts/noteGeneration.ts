/**
 * Prompt terpusat untuk generator catatan Eureka.AI.
 * Mengikuti prinsip Diátaxis Framework (Tutorial, How-to, Explanation, Reference)
 * agar setiap bab terstruktur seperti buku teks — bukan sekadar teks polos.
 *
 * Struktur yang dihasilkan didukung penuh oleh parseNoteContent
 * (## sub-judul, - bullet, | tabel |, > kutipan, **tebal**, ![alt](url) gambar).
 */

export const NOTE_GENERATION_SYSTEM_PROMPT = `Kamu adalah Eureka.AI — Asisten Pembelajaran Cerdas yang mengubah materi mentah (subtitle YouTube, artikel, dokumen, audio, video) menjadi catatan belajar komprehensif bergaya buku teks.

Gunakan pendekatan 4 kuadran Diátaxis untuk menyusun setiap bab:
1. **Tutorial** — panduan langkah demi langkah untuk memahami topik ("cara kerjanya").
2. **How-to** — solusi praktis untuk masalah spesifik (contoh: "bagaimana menghitung...").
3. **Explanation** — penjelasan mendalam tentang konsep, teori, latar belakang (pakai analogi).
4. **Reference** — data referensi: tabel, rumus, fakta kunci, poin-poin ringkas.

Aturan wajib:
1. Setiap bab memiliki keempat kuadran, masing-masing minimal 3-5 kalimat (Reference berupa 4-6 bullet).
2. Minimal 1 bab berisi "Alur Proses" dengan 4-6 langkah bernomor.
3. Setiap bab diakhiri "Catatan Pribadi" — rangkuman inti 3-5 kalimat gaya catatan tangan siswa.
4. Jangan menambah informasi yang tidak ada di sumber (no hallucination).
5. Gabungkan potongan mentah menjadi paragraf utuh yang koheren.
6. Hasil harus lengkap dan mendalam, bukan ringkasan dangkal.`;

/** Struktur markdown yang wajib dipakai AI di dalam "content" setiap bab. */
export const CHAPTER_CONTENT_GUIDE = `"content" HARUS memakai struktur markdown berikut agar tampil rapi seperti buku (JANGAN hanya teks polos):
- "## 📚 Tutorial: <judul>" diikuti 3-5 kalimat langkah-langkah
- "## 🛠️ How-to: <judul>" diikuti 3-5 kalimat solusi praktis
- "## 💡 Explanation: <judul>" diikuti 4-6 kalimat penjelasan konsep (pakai analogi bila perlu)
- "## 📊 Reference: <judul>" diikuti 4-6 bullet "- ..." berisi data/fakta/rumus kunci
- (jika relevan) "## 🔄 Alur Proses:" diikuti langkah bernomor "- 1. ..." dst
- "## 📝 Catatan Pribadi:" diikuti 3-5 kalimat rangkuman gaya catatan tangan
- Gunakan "**teks**" untuk menekankan istilah penting, "- " untuk daftar, dan tabel "| A | B |" bila ada perbandingan/data.`;

/** Petunjuk pemilihan gambar yang boleh dipakai AI di konten bab. */
export function buildImageGuide(
  images: { url: string; alt: string }[]
): string {
  if (images.length === 0) {
    return "(tidak ada gambar tersedia — tulis teks saja, JANGAN membuat URL gambar)";
  }
  return images
    .slice(0, 20)
    .map((img, i) => `${i + 1}. ${img.alt || "tanpa keterangan"} → ${img.url}`)
    .join("\n");
}

/** Aturan penempatan gambar yang wajib ditaati AI. */
export const IMAGE_PLACEMENT_RULES = `Sisipkan GAMBAR dari daftar yang tersedia dengan format: ![keterangan singkat](URL_GAMBAR_ASLI)
- Hanya boleh memakai URL dari daftar — JANGAN membuat/menebak URL sendiri.
- Maksimal 2 gambar per bab, di posisi paling relevan dengan konteks.
- Keterangan (alt) harus deskriptif dan sesuai isi gambar.`;

/** Preferensi pengguna (dari layar Atur Catatan). */
export interface NotePreferences {
  studyMode?: "ringkas" | "standar" | "lengkap";
  gayaPenulisan?: string;
  bahasa?: string;
}

export const STUDY_MODE_RULES: Record<string, string> = {
  ringkas:
    "Ringkas: 3-5 poin inti per kuadran, fokus ke yang penting, tanpa detail berlebihan.",
  standar:
    "Standar: jelaskan tiap topik dengan 4-6 kalimat jelas dan 2-4 poin pendukung.",
  lengkap:
    "Lengkap & mendalam: uraikan detail, contoh, data, dan penjelasan menyeluruh (6-10 kalimat per kuadran, lengkap dengan tabel/perbandingan bila relevan).",
};

/** Kalimat preferensi siap pakai dalam prompt. */
export function buildPreferencesText(prefs: NotePreferences): string {
  const parts = [
    `- Bahasa: ${prefs.bahasa || "Bahasa Indonesia"}`,
    `- Gaya penulisan: ${prefs.gayaPenulisan || "Ramah & Santai"}`,
    `- Kedalaman: ${
      STUDY_MODE_RULES[prefs.studyMode ?? "standar"] ?? STUDY_MODE_RULES.standar
    }`,
  ];
  return parts.join("\n");
}

/** Struktur bab sesuai Mode Belajar (dipakai prompt generator bab). */
export const MODE_CHAPTER_RULES: Record<string, string> = {
  ringkas: `Mode RINGKAS: seluruh catatan maksimal 500 kata.
- Cukup 1-2 bab.
- Setiap bab: "## Ringkasan" (3-5 kalimat langsung ke inti), "## Poin-poin Penting" (5 bullet "- ..."), "## Kesimpulan" (1 paragraf singkat).
- Tanpa basa-basi, langsung ke inti.`,
  standar: `Mode STANDAR (800-1500 kata): 2-3 bab yang seimbang.
- Tiap bab: pembuka 2-3 kalimat, lalu sub-judul "## " untuk tiap aspek/topik, tutup dengan "## 💡 Intisari" (2-3 kalimat).
- Pakai tabel "| A | B |" bila ada perbandingan, dan "**teks**" untuk istilah penting.`,
  lengkap: `Mode LENGKAP (2000-4000 kata): 3-5 bab yang mendalam.
${CHAPTER_CONTENT_GUIDE}
- Di bab TERAKHIR tambahkan:
  - "## 🗺️ Mind Map" — peta pikiran berformat "- Cabang > Sub-cabang > detail" (5-8 cabang)
  - "## 📖 Glosarium" — 5-10 istilah penting dengan format "- istilah: definisi singkat"`,
};

/** Aturan mode siap pakai dalam prompt. */
export function buildModeRules(prefs: NotePreferences): string {
  return (
    MODE_CHAPTER_RULES[prefs.studyMode ?? "standar"] ??
    MODE_CHAPTER_RULES.standar
  );
}
