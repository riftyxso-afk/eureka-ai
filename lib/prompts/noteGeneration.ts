/**
 * Prompt terpusat untuk generator catatan Eureka.AI.
 * Mengikuti prinsip Diátaxis Framework (Tutorial, How-to, Explanation, Reference)
 * agar setiap bab terstruktur seperti buku teks — bukan sekadar teks polos.
 *
 * Struktur yang dihasilkan didukung penuh oleh parseNoteContent
 * (## sub-judul, - bullet, | tabel |, > kutipan, **tebal**, ![alt](url) gambar).
 */

import { AI_SAFETY_GUARDRAIL } from "./safety";

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
6. Hasil harus lengkap dan mendalam, bukan ringkasan dangkal.

${AI_SAFETY_GUARDRAIL}`;

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
  /** Jumlah bab yang diminta user (1-6). */
  chapterCount?: number;
  /** Mode pembuatan: "cepat" = ringkas & kilat, "lengkap" = detail & tervalidasi. */
  generationMode?: "cepat" | "lengkap";
  /** Mode soal/tugas: teks berisi pertanyaan yang harus dijawab tuntas. */
  assignment?: boolean;
  /** Terjemahkan materi sumber ke bahasa target (biasanya Indonesia). */
  translate?: boolean;
  /** Jenis rangkuman: biasa | makalah | laporan | poin. */
  noteType?: NoteType;
}

/** Jenis rangkuman yang bisa dipilih user saat membuat catatan. */
export type NoteType = "rangkuman" | "makalah" | "laporan" | "poin";

/** Label tampilan (badge) per jenis rangkuman. */
export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  rangkuman: "Rangkuman",
  makalah: "Makalah",
  laporan: "Laporan",
  poin: "Poin Penting",
};

/** Aturan struktur per jenis rangkuman (dimasukkan ke prompt). */
export const NOTE_TYPE_RULES: Record<NoteType, string> = {
  rangkuman: `Jenis: CATATAN RANGKUMAN biasa bergaya buku teks — susun sesuai mode yang dipilih (Diátaxis / ringkas / standar / lengkap).`,
  makalah: `Jenis: MAKALAH akademik. Susun dengan struktur formal:
- Bagian Awal: judul makalah, lalu "## Latar Belakang" (2-3 paragraf konteks & alasan pentingnya topik).
- "## Kajian Teori / Tinjauan Pustaka" — 1-2 bab berisi konsep, istilah, dan teori yang relevan dari sumber.
- "## Pembahasan" — analisis mendalam topik dari sumber (pakai tabel perbandingan bila relevan).
- "## Kesimpulan" — rangkum temuan utama (tanpa menambah info baru).
- "## Daftar Pustaka" — daftar sumber yang dipakai (dari materi yang tersedia).
- Tulis formal, objektif, dan ilmiah (hindari sapaan akrab). Tanpa kuadran Diátaxis.`,
  laporan: `Jenis: LAPORAN. Susun dengan struktur:
- "## Judul & Identitas" — judul laporan.
- "## Tujuan" — tujuan laporan (2-4 bullet).
- "## Metode / Cara Kerja" — langkah-langkah bernomor.
- "## Hasil" — temuan/data utama (pakai tabel bila ada data).
- "## Pembahasan" — analisis hasil 1-2 paragraf.
- "## Kesimpulan" — 1 paragraf ringkas.
- Tulis objektif dan terstruktur. Tanpa kuadran Diátaxis.`,
  poin: `Jenis: POIN-POIN PENTING. Susun super ringkas untuk belajar cepat:
- "## Poin Utama" — 5-10 bullet "- ..." langsung ke inti.
- "## Fakta & Istilah Kunci" — bullet pendek.
- "## Rumus/Catatan Penting" — bullet bila relevan.
- Tanpa paragraf panjang, tanpa tabel besar, tanpa kuadran Diátaxis.`,
};

/** Kalimat aturan jenis rangkuman siap pakai dalam prompt (default rangkuman). */
export function buildNoteTypeRule(prefs: NotePreferences): string {
  const type: NoteType =
    prefs.noteType === "makalah" ||
    prefs.noteType === "laporan" ||
    prefs.noteType === "poin"
      ? prefs.noteType
      : "rangkuman";
  return NOTE_TYPE_RULES[type];
}

export const MAX_CHAPTERS_ALLOWED = 6;

/** Clamp jumlah bab ke rentang yang diizinkan (1-6); undefined bila tidak diminta. */
export function clampChapterCount(value: unknown): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(MAX_CHAPTERS_ALLOWED, Math.max(1, Math.floor(n)));
}

/** Kalimat instruksi jumlah bab untuk prompt AI (bila user memilih jumlah). */
export function buildChapterCountRule(prefs: NotePreferences): string {
  const count = clampChapterCount(prefs.chapterCount);
  if (!count) return "";
  return `JUMLAH BAB: buat TEPAT ${count} bab — gabungkan topik bila perlu agar pas ${count} bab. Batas maksimal sistem adalah ${MAX_CHAPTERS_ALLOWED} bab.`;
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
  if (prefs.translate) {
    parts.push(
      `- TERJEMAHKAN: seluruh konten sumber WAJIB diterjemahkan ke "${prefs.bahasa || "Bahasa Indonesia"}" secara akurat — jangan menyalin kalimat asing.`
    );
  }
  return parts.join("\n");
}

/** Struktur bab sesuai Mode Belajar (dipakai prompt generator bab). */
export const MODE_CHAPTER_RULES: Record<string, string> = {
  ringkas: `Mode RINGKAS: seluruh catatan maksimal 500 kata.
- Jumlah bab MENGIKUTI instruksi JUMLAH BAB di atas (bila ada); jangan menambah atau mengurangi sendiri.
- Setiap bab: "## Ringkasan" (3-5 kalimat langsung ke inti), "## Poin-poin Penting" (5 bullet "- ..."), "## Kesimpulan" (1 paragraf singkat).
- Tanpa basa-basi, langsung ke inti.`,
  standar: `Mode STANDAR (800-1500 kata).
- Jumlah bab MENGIKUTI instruksi JUMLAH BAB di atas (bila ada); jangan menambah atau mengurangi sendiri.
- Tiap bab: pembuka 2-3 kalimat, lalu sub-judul "## " untuk tiap aspek/topik, tutup dengan "## 💡 Intisari" (2-3 kalimat).
- Pakai tabel "| A | B |" bila ada perbandingan, dan "**teks**" untuk istilah penting.`,
  lengkap: `Mode LENGKAP (2000-4000 kata).
- Jumlah bab MENGIKUTI instruksi JUMLAH BAB di atas (bila ada); jangan menambah atau mengurangi sendiri.
${CHAPTER_CONTENT_GUIDE}
- Di bab TERAKHIR tambahkan:
  - "## 🗺️ Mind Map" — peta pikiran berformat "- Cabang > Sub-cabang > detail" (5-8 cabang)
  - "## 📖 Glosarium" — 5-10 istilah penting dengan format "- istilah: definisi singkat"`,
};

/**
 * Panduan struktur konten bab: mode CEPAT memakai struktur ringkas
 * (bukan 4 kuadran Diátaxis penuh) agar tidak ada instruksi yang bertentangan.
 * Jenis rangkuman (makalah/laporan/poin) mengambil alih struktur konten.
 */
export function buildChapterContentGuide(prefs: NotePreferences): string {
  if (prefs.assignment) {
    return `Struktur konten bab (mode SOAL/TUGAS): "## Jawaban" (uraian tuntas 1-3 paragraf), "## Penjelasan" (alasan benar / langkah pengerjaan bernomor), "## Poin Kunci" (3-5 bullet "- ..."). Tanpa kuadran Diátaxis.`;
  }
  if (prefs.noteType === "makalah" || prefs.noteType === "laporan" || prefs.noteType === "poin") {
    return `Struktur konten mengikuti jenis rangkuman yang dipilih (lihat aturan jenis). Tanpa kuadran Diátaxis.`;
  }
  if (prefs.generationMode === "cepat") {
    return `Struktur konten bab (mode CEPAT): "## Ringkasan" (3-4 kalimat padat), "## Poin Penting" (4-5 bullet "- ..." singkat), "## Kesimpulan" (1 kalimat). Tanpa sub-judul lain yang berlebihan, tanpa tabel besar.`;
  }
  return CHAPTER_CONTENT_GUIDE;
}

/** Aturan mode CEPAT: hasil singkat, padat, dan cepat selesai. */
export const GENERATION_MODE_RULES: Record<string, string> = {
  cepat: `Mode CEPAT (kilat & ringkas): seluruh catatan maksimal 400 kata.
- Jumlah bab MENGIKUTI instruksi JUMLAH BAB di atas (bila ada); jangan menambah atau mengurangi sendiri.
- Tiap bab: "## Ringkasan" (3-4 kalimat padat), "## Poin Penting" (4-5 bullet "- ..." singkat), "## Kesimpulan" (1 kalimat).
- Tanpa tabel besar, tanpa mind map, tanpa glosarium — fokus ke kecepatan selesai.
- Tetap akurat: hanya tulis fakta yang ada di sumber (no hallucination).`,
};

/**
 * Gaya penulisan "Alami & Manusiawi" — membuat hasil AI terdengar lebih
 * seperti tulisan manusia: variasi panjang kalimat, bahasa sehari-hari,
 * dan menghindari frasa klise yang umum pada teks AI.
 */
export const HUMAN_STYLE_RULES = `GAYA PENULISAN "ALAMI & MANUSIAWI" — WAJIB diikuti:
- Variasikan panjang kalimat: selang-seling kalimat pendek dan panjang, jangan semuanya seragam.
- Gunakan bahasa sehari-hari yang wajar ("jadi", "intinya", "nanti kita lihat") sesekali, tapi tetap rapi.
- Hindari frasa klise AI seperti "dalam dunia yang semakin berkembang", "perlu diingat bahwa", "dengan demikian", "kesimpulannya, dapat dikatakan".
- Jangan memakai kata sambung yang sama berulang-ulang (jika/maka/sehingga di tiap kalimat).
- Tulis seperti mahasiswa/siswa yang paham materi lalu menjelaskannya dengan kata sendiri — bukan esai formal kaku.
- Tidak perlu menyebut "Sebagai AI" atau "Sebagai asisten".`;

/**
 * Mode SOAL/TUGAS — teks sumber berisi pertanyaan yang harus dijawab tuntas
 * dan akurat, bukan sekadar dirangkum.
 */
export const ASSIGNMENT_MODE_RULES = `MODE SOAL/TUGAS — teks sumber adalah soal dari guru/dosen. Tugasmu:
- Jawab SETIAP pertanyaan yang ada dengan lengkap, benar, dan terstruktur.
- Pecah jawaban menjadi bab: satu bab per soal utama (atau per topik jika soalnya esai panjang).
- Tiap bab: "## Jawaban" (uraian tuntas, 1-3 paragraf), "## Penjelasan" (kenapa jawaban itu benar / langkah pengerjaan), "## Poin Kunci" (3-5 bullet).
- Untuk soal hitungan: tuliskan rumus, langkah pengerjaan bernomor, dan hasil akhir.
- Untuk soal esai: jawab dengan argumen lengkap + contoh konkret bila relevan.
- JANGAN membuang soal — pastikan semua terjawab. No hallucination.`;

/** Aturan mode siap pakai dalam prompt. */
export function buildModeRules(prefs: NotePreferences): string {
  if (prefs.assignment) {
    return ASSIGNMENT_MODE_RULES;
  }
  if (prefs.noteType === "makalah" || prefs.noteType === "laporan" || prefs.noteType === "poin") {
    return buildNoteTypeRule(prefs);
  }
  if (prefs.generationMode === "cepat") {
    return GENERATION_MODE_RULES.cepat;
  }
  return (
    MODE_CHAPTER_RULES[prefs.studyMode ?? "standar"] ??
    MODE_CHAPTER_RULES.standar
  );
}

/** Aturan gaya penulisan tambahan (dipanggil oleh pemanggil prompt). */
export function buildHumanizeRules(prefs: NotePreferences): string {
  if (prefs.gayaPenulisan === "Alami & Manusiawi") {
    return HUMAN_STYLE_RULES;
  }
  return "";
}
