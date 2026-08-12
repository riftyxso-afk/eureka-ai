/**
 * Menyusun DOKUMEN PDF yang berbeda dari catatan — bukan salinan bab.
 *
 * Prinsip: bab catatan dipakai sebagai REFERENSI saja. AI lalu:
 *  1. Menyaring intisari tiap bab (essence + poin kunci) — materi acuan.
 *  2. Menyusun KERANGKA DOKUMEN BARU (judul & bab dengan organisasi sendiri,
 *     diawali Pendahuluan, diakhiri Kesimpulan).
 *  3. Menulis ulang tiap bab dokumen dengan narasi baru & kata-kata sendiri.
 *  4. Menulis abstrak/kata pengantar dokumen baru.
 *
 * Hasil akhirnya berupa dokumen utuh yang rapi (tanpa emoji/gambar/tabel
 * markdown), layak cetak ke PDF oleh skrip Python (reportlab) atau pdfkit.
 *
 * PENTING: komposisi WAJIB memakai AI sungguhan. Bila AI tidak tersedia atau
 * sibuk (kuota/5xx) fungsi LEMPAR ERROR — TIDAK ada fallback yang menyalin
 * konten mentah. Route stream mengubahnya menjadi event `error` → popup,
 * dan PDF tidak digenerate (menghindari hasil copy-paste bab).
 */
import { aiChatJson, extractJsonObject, hasAiKey } from "./ai";
import type { NoteChapter } from "./types";

export interface PdfEnrichedChapter {
  title: string;
  content: string;
}

export interface PdfEnrichedNote {
  title: string;
  subject: string;
  summary: string;
  createdAt: string;
  chapters: PdfEnrichedChapter[];
}

export type EnrichProgressFn = (percent: number, message: string) => void;

const MAX_REF_CHARS = 14000;

/* ───────────────────────── Prompt AI ───────────────────────── */

const DISTILL_SYSTEM = `Kamu adalah analis materi. Tugasmu menyaring INTISARI dari sebuah bab catatan belajar agar bisa dipakai sebagai bahan referensi menulis dokumen baru.

Aturan:
- "essence": 2-3 kalimat yang merangkum inti bab dengan kata-kata baru.
- "points": 3-5 poin kunci paling penting (1 baris per poin).
- JANGAN menyalin kalimat panjang dari sumber; ringkas dengan bahasa sendiri.
Output HANYA JSON: {"essence": "...", "points": ["...", "..."]}`;

const OUTLINE_SYSTEM = `Kamu adalah penyusun kerangka dokumen akademik (laporan/makalah). Dari kumpulan intisari materi, susun KERANGKA DOKUMEN BARU yang rapi dan profesional.

Aturan:
- "title": judul dokumen baru (boleh lebih formal & berbeda dari judul catatan, maksimal 12 kata).
- "chapters": 4-7 bab yang terorganisir OLEH TOPIK (bukan salinan urutan bab sumber).
  - Bab pertama WAJIB "Pendahuluan" (latar belakang, tujuan, ruang lingkup).
  - Bab terakhir WAJIB "Kesimpulan" (rangkuman & saran).
  - Bab tengah mengelompokkan materi secara logis, tiap bab punya 2-4 "topics" (1 baris per topik).
- Jangan menambah fakta yang tidak ada di materi.
Output HANYA JSON: {"title": "...", "chapters": [{"title": "...", "topics": ["...", "..."]}]}`;

const WRITE_SYSTEM = `Kamu adalah penulis dokumen akademik yang mahir. Tulis SATU bab dokumen dari kerangka yang diberikan, menggunakan intisari materi hanya sebagai REFERENSI.

Aturan WAJIB:
- TULIS ULANG dengan kata-kata dan urutan pikiranmu sendiri — JANGAN menyalin kalimat dari referensi.
- Susun menjadi PARAGRAF yang koheren dan mengalir (bukan poin mentah), bahasa Indonesia baku namun enak dibaca.
- Gunakan "## " untuk sub-judul yang penting saja (maksimal 2 per bab).
- Gunakan "- " untuk daftar singkat bila cocok (maksimal 6 butir).
- JANGAN memakai emoji, gambar (![...](...)), atau tabel markdown (| ... |) — ubah data menjadi kalimat deskriptif.
- JANGAN menambah fakta baru di luar referensi.
- Akhiri dengan "## Intisari" berisi 2-3 kalimat simpulan bab.
Output HANYA JSON: {"content": "..."}`;

const ABSTRACT_SYSTEM = `Kamu adalah penulis abstrak dokumen akademik. Tulis ABSTRAK 1-2 paragraf yang merangkum dokumen (latar belakang, isi utama, kesimpulan) dengan bahasa formal dan mengalir.
- Tanpa emoji, tanpa poin-poin, tanpa menyalin kalimat dari isi bab.
- Akhiri dengan 1 kalimat tentang manfaat dokumen bagi pembelajar.
Output HANYA JSON: {"summary": "..."}`;

/* ───────────────────────── Tahap 1: intisari ───────────────────────── */

interface DistilledChapter {
  title: string;
  essence: string;
  points: string[];
}

async function distillChapter(chapter: NoteChapter): Promise<DistilledChapter> {
  const content = chapter.content.trim();
  if (content.length < 120) {
    return { title: chapter.title, essence: content, points: [] };
  }
  const parsed = await aiChatJson<{ essence?: unknown; points?: unknown }>(
    {
      system: DISTILL_SYSTEM,
      user: `Judul bab: ${chapter.title}\n\nIsi bab:\n${content.slice(0, MAX_REF_CHARS)}`,
      json: true,
      maxTokens: 1000,
      temperature: 0.3,
    },
    (raw) => extractJsonObject<{ essence?: unknown; points?: unknown }>(raw)
  );
  return {
    title: chapter.title,
    essence:
      typeof parsed.essence === "string" && parsed.essence.trim()
        ? parsed.essence.trim()
        : content.slice(0, 500),
    points: Array.isArray(parsed.points)
      ? (parsed.points as unknown[])
          .map((p) => (typeof p === "string" ? p.trim() : ""))
          .filter(Boolean)
          .slice(0, 6)
      : [],
  };
}

/* ───────────────────── Tahap 2: kerangka dokumen ───────────────────── */

interface DocOutlineChapter {
  title: string;
  topics: string[];
}

interface DocOutline {
  title: string;
  chapters: DocOutlineChapter[];
}

function buildReferenceText(distilled: DistilledChapter[]): string {
  return distilled
    .map(
      (d, i) =>
        `Referensi ${i + 1} ("${d.title}"):\n- Intisari: ${d.essence}\n${
          d.points.length > 0
            ? `- Poin: ${d.points.map((p) => `• ${p}`).join(" ")}`
            : ""
        }`
    )
    .join("\n\n");
}

async function composeOutline(
  noteTitle: string,
  distilled: DistilledChapter[]
): Promise<DocOutline> {
  const parsed = await aiChatJson<{ title?: unknown; chapters?: unknown }>(
    {
      system: OUTLINE_SYSTEM,
      user: `Judul catatan sumber: "${noteTitle}"\n\nIntisari materi:\n${buildReferenceText(
        distilled
      ).slice(0, 20000)}`,
      json: true,
      maxTokens: 2500,
      temperature: 0.3,
    },
    (raw) => extractJsonObject<{ title?: unknown; chapters?: unknown }>(raw)
  );
  const chapters = Array.isArray(parsed.chapters)
    ? (parsed.chapters as Record<string, unknown>[])
        .map((c, i) => ({
          title:
            typeof c.title === "string" && c.title.trim()
              ? c.title.trim().slice(0, 120)
              : `Bagian ${i + 1}`,
          topics: Array.isArray(c.topics)
            ? (c.topics as unknown[])
                .map((t) => (typeof t === "string" ? t.trim() : ""))
                .filter(Boolean)
                .slice(0, 4)
            : [],
        }))
        .filter((c) => c.title)
        .slice(0, 7)
    : [];
  if (chapters.length < 2) {
    throw new Error("AI tidak menyusun kerangka dokumen.");
  }

  // Jamin struktur yang diminta user: bab 1 = Pendahuluan, bab akhir = Kesimpulan
  // (kalau model lupa, tambahkan sendiri dari referensi yang tersedia).
  const isIntro = /pendahuluan|pengantar|latar\s*belakang/i.test(chapters[0]?.title ?? "");
  const isClosing = /kesimpulan|penutup|simpulan/i.test(chapters[chapters.length - 1]?.title ?? "");
  if (!isIntro) {
    chapters.unshift({
      title: "Pendahuluan",
      topics: ["Latar belakang materi", "Tujuan dokumen", "Ruang lingkup pembahasan"],
    });
  }
  if (!isClosing) {
    chapters.push({
      title: "Kesimpulan",
      topics: ["Rangkuman poin utama", "Implikasi bagi pembelajar"],
    });
  }

  return {
    title:
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim().slice(0, 140)
        : noteTitle,
    chapters: chapters.slice(0, 7),
  };
}

/* ──────────────────── Tahap 3: tulis tiap bab ──────────────────── */

async function writeDocChapter(
  outline: DocOutlineChapter,
  distilled: DistilledChapter[],
  previous: PdfEnrichedChapter[]
): Promise<string> {
  const prevText =
    previous.length > 0
      ? previous.map((c) => `- ${c.title}: ${c.content.slice(0, 200)}`).join("\n")
      : "(bab pertama)";

  const parsed = await aiChatJson<{ content?: unknown }>(
    {
      system: WRITE_SYSTEM,
      user: `Judul bab dokumen: "${outline.title}"\nTopik yang wajib dibahas:\n${outline.topics
        .map((t) => `- ${t}`)
        .join("\n")}\n\nReferensi materi (hanya sebagai acuan, TULIS ULANG dengan katamu sendiri):\n${buildReferenceText(
        distilled
      ).slice(0, MAX_REF_CHARS)}\n\nBab yang sudah ditulis (jangan diulang):\n${prevText}`,
      json: true,
      maxTokens: 4500,
      temperature: 0.35,
    },
    (raw) => extractJsonObject<{ content?: unknown }>(raw)
  );
  if (typeof parsed.content !== "string" || parsed.content.trim().length < 60) {
    throw new Error("AI tidak menghasilkan isi bab dokumen.");
  }
  return parsed.content.trim();
}

/* ──────────────────── Tahap 4: abstrak / pengantar ──────────────────── */

async function composeAbstract(
  title: string,
  chapters: PdfEnrichedChapter[]
): Promise<string> {
  const chapterHints = chapters
    .map((c) => `- ${c.title}: ${c.content.slice(0, 220)}`)
    .join("\n");
  const parsed = await aiChatJson<{ summary?: unknown }>(
    {
      system: ABSTRACT_SYSTEM,
      user: `Judul dokumen: "${title}"\n\nRingkasan tiap bab:\n${chapterHints.slice(
        0,
        12000
      )}`,
      json: true,
      maxTokens: 1200,
      temperature: 0.3,
    },
    (raw) => extractJsonObject<{ summary?: unknown }>(raw)
  );
  if (typeof parsed.summary === "string" && parsed.summary.trim().length > 40) {
    return parsed.summary.trim();
  }
  throw new Error("AI tidak menghasilkan abstrak.");
}

/* ──────────────────── Alur utama: susun dokumen baru ──────────────────── */

/**
 * Susun DOKUMEN baru dari catatan (WAJIB AI):
 * intisari → kerangka → tulis ulang bab → abstrak.
 *
 * Bila AI tidak tersedia / sibuk → LEMPAR ERROR (route stream mengirim event
 * `error` → popup). Tidak ada fallback salinan konten mentah.
 */
export async function enrichNoteForPdf(
  note: {
    title?: string;
    subject?: string;
    summary?: string;
    createdAt?: string;
    chapters?: NoteChapter[];
  },
  onProgress?: EnrichProgressFn
): Promise<PdfEnrichedNote> {
  if (!hasAiKey()) {
    throw new Error(
      "Server AI tidak tersedia — aktifkan API key AI untuk menyusun dokumen."
    );
  }

  const rawChapters = (note.chapters ?? []).filter(
    (c) => c && typeof c.title === "string" && typeof c.content === "string"
  );
  if (rawChapters.length === 0) {
    throw new Error("Catatan belum memiliki bab untuk disusun menjadi dokumen.");
  }

  const subject = note.subject ?? "";
  const createdAt = note.createdAt ?? "";

  // 1) Intisari tiap bab (referensi) — 2-30%
  onProgress?.(3, "Membaca catatan sebagai referensi...");
  const distilled: DistilledChapter[] = [];
  const total = rawChapters.length;
  for (let i = 0; i < total; i++) {
    onProgress?.(
      3 + ((i + 0.5) / total) * 26,
      `Menyaring intisari ${i + 1}/${total}: ${rawChapters[i].title}`
    );
    distilled.push(await distillChapter(rawChapters[i]));
  }
  onProgress?.(30, "Intisari siap — menyusun kerangka dokumen baru...");

  // 2) Kerangka dokumen baru — 30-38%
  const outline = await composeOutline(note.title || "Dokumen", distilled);
  onProgress?.(38, "Kerangka dokumen siap — menulis isi...");

  // 3) Tulis tiap bab dokumen — 38-88%
  const chapters: PdfEnrichedChapter[] = [];
  for (let i = 0; i < outline.chapters.length; i++) {
    const c = outline.chapters[i];
    onProgress?.(
      38 + ((i + 0.5) / outline.chapters.length) * 50,
      `Menulis isi dokumen ${i + 1}/${outline.chapters.length}: ${c.title}`
    );
    const content = await writeDocChapter(c, distilled, chapters);
    chapters.push({ title: c.title, content });
  }
  onProgress?.(88, "Isi dokumen selesai — menulis abstrak...");

  // 4) Abstrak / kata pengantar — 88-96%
  const abstract = await composeAbstract(outline.title, chapters);
  onProgress?.(96, "Dokumen siap dicetak — menyusun file...");

  return {
    title: outline.title,
    subject,
    summary: abstract,
    createdAt,
    chapters,
  };
}
