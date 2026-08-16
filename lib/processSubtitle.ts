/**
 * Mengubah teks mentah (subtitle YouTube / hasil ekstraksi) menjadi
 * chapter-chapter terstruktur dengan judul yang jelas.
 *
 * - Metode AI (rekomendasi): Chat Completions → JSON [{title, content, timestamp?}]
 * - Metode parsing manual (fallback): pengelompokan berdasarkan segmen
 *   transkrip (dengan timestamp) atau kalimat.
 */
import type { NoteChapter } from "./types";
import type { TranscriptSegment } from "./rag/extract";
import { aiChatJson, extractJsonObject, hasAiKey, isAiBusyError } from "./ai";
import type { PhaseProgressFn } from "./progressTracker";
import {
  buildChapterContentGuide,
  buildChapterCountRule,
  buildHumanizeRules,
  buildModeRules,
  buildPreferencesText,
  clampChapterCount,
  type NotePreferences,
} from "./prompts/noteGeneration";

const MAX_CHAPTERS = 10;
const MIN_WORDS_PER_CHAPTER = 180;

const FILLER_WORDS = [
  "jadi", "dan", "eh", "ya", "nah", "oke", "ok", "guys", "jadi gitu", "lanjut",
  "untuk", "dengan", "kita", "kalau", "kalo", "ketika", "terus", "kemudian",
  "lah", "deh", "nih", "tuh", "kan", "dong", "sih", "banget", "juga", "bisa",
  "ini", "itu", "yang",
];

function formatTimestamp(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Bersihkan kalimat pembuka subtitle → judul pendek yang mudah dibaca. */
function makeTitle(text: string): string {
  let t = text.trim().replace(/\s+/g, " ");
  const m = t.match(/^.{1,120}?[.!?](\s|$)/);
  if (m) t = m[0];
  const words = t.split(/\s+/).filter(Boolean);
  while (
    words.length > 1 &&
    FILLER_WORDS.includes(words[0].toLowerCase().replace(/[^\w]/g, ""))
  ) {
    words.shift();
  }
  if (words.length === 0) return "Pembahasan Utama";
  const kept = words.slice(0, 8).join(" ").replace(/[.!?]+$/, "");
  return kept.charAt(0).toUpperCase() + kept.slice(1);
}

function splitIntoSentences(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length > 0) return parts;
  // Tidak ada tanda baca → pecah berdasarkan kata
  const words = text.split(/\s+/).filter(Boolean);
  const sentences: string[] = [];
  for (let i = 0; i < words.length; i += 14) {
    sentences.push(words.slice(i, i + 14).join(" "));
  }
  return sentences;
}

/** Hapus noise subtitle: [Musik], [Tepuk tangan], emoji, dll. */
function stripSubtitleNoise(text: string): string {
  return text
    .replace(
      /[\[(].*?(musik|music|applause|laughter|tepuk|suara|sound|noise).*?[\])]/gi,
      ""
    )
    .replace(/\[.*?\]|\(.*?\)/g, "")
    .replace(/♪|♪|🎵|🎶/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Buang kalimat yang berulang-ulang (umum di subtitle). */
function dedupeSentences(sentences: string[]): string[] {
  const seen = new Set<string>();
  return sentences.filter((s) => {
    const key = s.toLowerCase().replace(/\W/g, "").slice(0, 40);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Ringkasan ekstraktif (tanpa AI): ambil kalimat-kalimat paling informatif
 * hingga batas jumlah kalimat/kata — bukan salinan verbatim.
 */
function summarizeExtractively(
  text: string,
  maxSentences = 4,
  maxWords = 110
): string {
  const sentences = dedupeSentences(
    splitIntoSentences(stripSubtitleNoise(text))
  ).filter((s) => {
    const w = countWords(s);
    return w >= 3 && w <= 45;
  });

  const picked: string[] = [];
  let words = 0;
  for (const s of sentences) {
    const w = countWords(s);
    if (picked.length > 0 && words + w > maxWords) break;
    picked.push(s);
    words += w;
    if (picked.length >= maxSentences) break;
  }
  return picked.join(" ");
}

/**
 * Metode 2: Parsing manual (fallback).
 * Jika ada segments (transkrip YouTube), kelompokkan dengan timestamp asli.
 * Jumlah bab mengikuti chapterCount bila diminta user, baru diturunkan ke
 * target berbasis jumlah kata bila materi terlalu pendek.
 */
function chaptersManually(
  text: string,
  segments?: TranscriptSegment[],
  chapterCount?: number
): NoteChapter[] {
  // Jumlah target: hormati permintaan user (max MAX_CHAPTERS), tetapi jangan
  // memaksa bab melebihi kapasitas materi — minimal 2 bab.
  const totalWords = countWords(text);
  const byWords = Math.min(
    MAX_CHAPTERS,
    Math.max(2, Math.ceil(totalWords / MIN_WORDS_PER_CHAPTER))
  );
  const requested = clampChapterCount(chapterCount);
  const targetChapters = requested
    ? Math.min(requested, Math.max(2, byWords))
    : byWords;

  if (!segments || segments.length === 0) {
    const sentences = splitIntoSentences(text);
    const wordsPerChapter = Math.ceil(totalWords / targetChapters);

    const chapters: NoteChapter[] = [];
    let buffer: string[] = [];
    let words = 0;

    for (const sentence of sentences) {
      const w = countWords(sentence);
      if (buffer.length > 0 && words + w > wordsPerChapter) {
        chapters.push({
          id: chapters.length + 1,
          title: makeTitle(buffer[0]),
          content: buffer.join(" "),
        });
        buffer = [];
        words = 0;
        if (chapters.length >= targetChapters) break;
      }
      buffer.push(sentence);
      words += w;
    }
    if (buffer.length > 0) {
      chapters.push({
        id: chapters.length + 1,
        title: makeTitle(buffer[0]),
        content: buffer.join(" "),
      });
    }
    return chapters;
  }

  const wordsPerChapter = Math.ceil(totalWords / targetChapters);

  const chapters: NoteChapter[] = [];
  let buffer: TranscriptSegment[] = [];
  let words = 0;

  for (const seg of segments) {
    const w = countWords(seg.text);
    if (buffer.length > 0 && words + w > wordsPerChapter) {
      const segText = buffer.map((s) => s.text).join(" ");
      chapters.push({
        id: chapters.length + 1,
        title: makeTitle(buffer[0].text),
        content: summarizeExtractively(segText),
        timestamp: formatTimestamp(buffer[0].offsetMs),
      });
      buffer = [];
      words = 0;
      if (chapters.length >= targetChapters) break;
    }
    buffer.push(seg);
    words += w;
  }
  if (buffer.length > 0) {
    chapters.push({
      id: chapters.length + 1,
      title: makeTitle(buffer[0].text),
      content: summarizeExtractively(
        buffer.map((s) => s.text).join(" ")
      ),
      timestamp: formatTimestamp(buffer[0].offsetMs),
    });
  }
  return chapters;
}

function extractJsonArray(raw: string): unknown {
  const clean = raw.replace(/```(?:json)?/gi, "").trim();
  const start = clean.indexOf("[");
  const end = clean.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Respons AI tidak mengandung array JSON.");
  }
  const candidate = clean.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch (e) {
    // Model thinking kadang menambahkan koma berlebih → perbaiki lalu coba lagi
    const fixed = candidate.replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(fixed);
    } catch {
      throw e instanceof Error
        ? new Error(`Respons AI bukan JSON valid: ${e.message}`)
        : e;
    }
  }
}

/**
 * Metode 1: AI membagi teks menjadi chapter logis dengan judul menarik.
 * Hanya dipakai jika API key AI tersedia (AIMurah/OpenAI-compatible).
 */
async function chaptersWithAI(
  text: string,
  segments?: TranscriptSegment[],
  prefs: NotePreferences = {}
): Promise<NoteChapter[]> {
  const timestampHints = segments
    ? segments
        .slice(0, 12)
        .map(
          (s) =>
            `[${formatTimestamp(s.offsetMs)}] ${s.text.slice(0, 80)}`
        )
        .join("\n")
    : "";

  const prompt = `Berikut adalah materi belajar mentah (bisa berupa subtitle video, isi dokumen, artikel web, atau gabungan beberapa sumber — tiap sumber diawali label [nomor. nama sumber]):

${text.slice(0, 24000)}

Tolong RINGKAS materi ini menjadi chapter yang logis berdasarkan topik yang dibahas.
Hilangkan label sumber, kata pengisi, dan bagian yang berulang — tulis ulang dengan bahasa yang rapi, jelas, dan mudah dipahami (bukan menyalin mentah).
Berikan judul singkat dan menarik untuk setiap chapter (maksimal 8 kata, bahasa Indonesia).

${buildModeRules(prefs)}

${buildPreferencesText(prefs)}

${buildHumanizeRules(prefs)}

${buildChapterCountRule(prefs)}

${buildChapterContentGuide(prefs)}

"flow" (opsional): array 2-6 langkah singkat yang menggambarkan urutan/proses di chapter itu (kosongkan jika tidak jelas).
Jika ada timestamp sertakan sebagai properti timestamp.

${
  timestampHints
    ? `Petunjuk timestamp (kira-kira posisi tiap bagian):\n${timestampHints}\n\n`
    : ""
}
Output HANYA JSON array, tanpa teks lain:
[{"title": "Judul Chapter 1", "content": "isi lengkap chapter 1 sesuai struktur di atas", "timestamp": "00:00", "flow": ["langkah 1", "langkah 2"]}, ...]`;

  const chapters = await aiChatJson<NoteChapter[]>(
    {
      system:
        "Kamu adalah asisten yang mengubah materi belajar mentah menjadi bab-bab terstruktur yang rapi dan ringkas. Jangan menyalin mentah — rangkum dan tulis ulang dengan jelas. Selalu jawab dengan JSON array yang valid, tanpa markdown atau teks tambahan.",
      user: prompt,
      json: true,
      maxTokens: 12000,
      temperature: 0.3,
    },
    (raw) => {
      const parsed = extractJsonArray(raw);
      if (!Array.isArray(parsed)) {
        throw new Error("Respons AI bukan array.");
      }
      const result = parsed
        .map((item: Record<string, unknown>, index) => ({
          id: index + 1,
          title:
            typeof item.title === "string" && item.title.trim()
              ? item.title.trim()
              : `Bab ${index + 1}`,
          content:
            typeof item.content === "string" && item.content.trim()
              ? item.content.trim()
              : "",
          timestamp:
            typeof item.timestamp === "string" && item.timestamp.trim()
              ? item.timestamp.trim()
              : undefined,
          flow: Array.isArray(item.flow)
            ? item.flow
                .map((f: unknown) =>
                  typeof f === "string" ? f.trim() : ""
                )
                .filter((f) => f.length > 0)
                .slice(0, 8)
            : undefined,
        }))
        .filter((c) => c.content.length > 0)
        .slice(0, MAX_CHAPTERS);

      if (result.length === 0) {
        throw new Error("AI tidak menghasilkan chapter.");
      }
      return result;
    }
  );
  return chapters;
}

/**
 * Konversi subtitle mentah menjadi chapter terstruktur.
 * useAI=true → coba AI dulu (jika key tersedia), jatuh ke parsing manual saat gagal.
 */
export async function processSubtitleToChapters(
  text: string,
  segments?: TranscriptSegment[],
  prefs: NotePreferences = {},
  useAI: boolean = true
): Promise<NoteChapter[]> {
  const clean = text.trim();
  if (clean.length === 0) return [];

  if (clean.length < 120) {
    return [
      {
        id: 1,
        title: "Pembahasan Utama",
        content: clean,
        timestamp: segments?.[0] ? formatTimestamp(segments[0].offsetMs) : undefined,
      },
    ];
  }

  if (useAI && hasAiKey() && clean.length > 400) {
    try {
      return await chaptersWithAI(clean, segments, prefs);
    } catch (e) {
      // AI sibuk/kuota habis → jangan jatuh ke subtitle mentah, biarkan
      // error naik ke job agar muncul popup "server sedang sibuk".
      if (isAiBusyError(e)) throw e;
      console.warn("[processSubtitle] AI gagal, pakai parsing manual:", e);
    }
  }

  return chaptersManually(clean, segments, prefs.chapterCount);
}

export interface AiSummaryResult {
  summary: string;
}

/**
 * Buat ringkasan rapi dari teks materi via AI.
 * Jika AI tidak tersedia/gagal → fallback potongan teks awal.
 */
export async function generateAiSummary(
  text: string,
  prefs: NotePreferences = {},
  fallbackMaxChars = 220
): Promise<string> {
  const clean = text.trim();
  if (clean.length < 120) return clean;

  if (hasAiKey()) {
    try {
      const parsed = await aiChatJson<{ summary?: unknown }>(
        {
          system:
            "Kamu adalah asisten perangkum materi belajar yang rapi dan padat. Jawab HANYA JSON tanpa teks lain.",
          user: `Berikut adalah materi/subtitle yang sudah dibagi menjadi bab:

${clean.slice(0, 20000)}

Buat ringkasan yang rapi (2-4 kalimat) yang mencakup poin penting seluruh materi.

${buildPreferencesText(prefs)}

${buildHumanizeRules(prefs)}

Output JSON: {"summary": "..."}`,
          json: true,
          maxTokens: 800,
          temperature: 0.3,
        },
        (raw) => extractJsonObject<{ summary?: unknown }>(raw)
      );
      if (typeof parsed.summary === "string" && parsed.summary.trim()) {
        return parsed.summary.trim();
      }
    } catch (e) {
      console.warn("[processSubtitle] Ringkasan AI gagal, pakai fallback:", e);
    }
  }

  return clean.slice(0, fallbackMaxChars);
}

export interface ProcessedContent {
  title: string;
  summary: string;
  chapters: NoteChapter[];
  keyPoints: string[];
}

/**
 * F8 — Rangkum BUKU/MODUL tebal.
 *
 * Buku panjang tidak bisa dikirim utuh ke AI (batas konteks). Strategi:
 * 1. Pecah teks menjadi beberapa bagian (~16rb karakter per bagian).
 * 2. Tiap bagian dirangkum menjadi 1-2 bab ringkas oleh AI (atau manual bila
 *    AI sibuk), sehingga tidak ada isi buku yang hilang.
 * 3. Gabung semua bab + ringkasan eksekutif + poin penting.
 */
export async function processLongDocumentToChapters(
  text: string,
  prefs: NotePreferences = {},
  onProgress?: PhaseProgressFn
): Promise<ProcessedContent> {
  const clean = text.trim();
  if (clean.length === 0) {
    return { title: "Rangkuman Buku", summary: "", chapters: [], keyPoints: [] };
  }

  const PART_SIZE = 16000;
  const MAX_PARTS = 6;
  const parts: string[] = [];
  for (let i = 0; i < clean.length && parts.length < MAX_PARTS; i += PART_SIZE) {
    parts.push(clean.slice(i, i + PART_SIZE));
  }

  // Pref per bagian: ringkas & cepat, maksimal 2 bab per bagian.
  const partPrefs: NotePreferences = {
    ...prefs,
    studyMode: "ringkas",
    generationMode: "cepat",
    chapterCount: 2,
  };

  const chapters: NoteChapter[] = [];
  const multiPart = parts.length > 1;

  for (let p = 0; p < parts.length; p++) {
    onProgress?.(
      0.08 + (p / parts.length) * 0.78,
      `Merangkum bagian ${p + 1}/${parts.length} buku...`
    );
    const partChapters = await processSubtitleToChapters(
      parts[p],
      undefined,
      partPrefs,
      true
    );
    for (const c of partChapters) {
      chapters.push({
        ...c,
        id: chapters.length + 1,
        title: multiPart ? `Bagian ${p + 1}: ${c.title}` : c.title,
      });
    }
  }

  onProgress?.(0.9, "Membuat ringkasan buku...");
  const allContent = chapters.map((c) => c.content).join("\n\n");
  const summary = await generateAiSummary(allContent, prefs, 300);

  const keyPoints = chapters
    .map((c) => {
      const first = splitIntoSentences(c.content)[0];
      return first ? `${c.title}: ${first}` : c.title;
    })
    .slice(0, 8);

  return {
    title: multiPart ? `Rangkuman Buku (${parts.length} bagian)` : "Rangkuman Buku",
    summary: summary || allContent.slice(0, 300),
    chapters,
    keyPoints,
  };
}

/**
 * Langkah 1: judul + daftar bab dari subtitle (output kecil → cepat selesai).
 * Dipisah dari penulisan bab agar tiap panggilan AI berukuran kecil dan
 * tidak melewati batas waktu — panggilan raksasa (semua bab sekaligus)
 * mudah gagal timeout lalu jatuh ke subtitle mentah.
 */
async function buildYoutubeOutline(
  text: string,
  prefs: NotePreferences
): Promise<{ title: string; chapters: { title: string; topics: string[] }[] }> {
  const prompt = `Berikut adalah subtitle/transkrip dari video YouTube:

${text.slice(0, 24000)}

Buat kerangka ringkasan belajar dari video ini:
- "title": judul ringkasan yang menarik (maksimal 10 kata, bahasa Indonesia)
- "chapters": bab berdasarkan topik-topik utama video.
  Untuk tiap bab berikan:
  - "title": judul singkat & jelas (maksimal 8 kata, bahasa Indonesia)
  - "topics": 2-4 topik kunci yang dibahas di bab itu (1 baris per topik)

${buildModeRules(prefs)}

${buildPreferencesText(prefs)}

${buildHumanizeRules(prefs)}

${buildChapterCountRule(prefs)}

Output HANYA JSON object, tanpa teks lain:
{"title": "...", "chapters": [{"title": "...", "topics": ["...", "..."]}, ...]}`;

  const parsed = await aiChatJson<{
    title: string;
    chapters: { title: string; topics: string[] }[];
  }>(
    {
      system:
        "Kamu adalah perencana catatan belajar. Jawab HANYA dengan JSON object valid dalam SATU BARIS, tanpa markdown atau teks lain.",
      user: prompt,
      json: true,
      maxTokens: 4000,
      temperature: 0.3,
    },
    (raw) => {
      const obj = extractJsonObject(raw) as Record<string, unknown>;
      const title =
        typeof obj.title === "string" && obj.title.trim()
          ? obj.title.trim().slice(0, 120)
          : "";
      const rawChapters = Array.isArray(obj.chapters) ? obj.chapters : [];
      const chapters = (rawChapters as Record<string, unknown>[])
        .map((item, index) => {
          const c = (item ?? {}) as Record<string, unknown>;
          return {
            title:
              typeof c.title === "string" && c.title.trim()
                ? c.title.trim().slice(0, 120)
                : `Bab ${index + 1}`,
            topics: Array.isArray(c.topics)
              ? (c.topics as unknown[])
                  .map((t) => (typeof t === "string" ? t.trim() : ""))
                  .filter(Boolean)
                  .slice(0, 4)
              : [],
          };
        })
        .filter((c) => c.title && c.title.trim().length > 0)
        .slice(0, clampChapterCount(prefs.chapterCount) ?? MAX_CHAPTERS);
      if (chapters.length === 0) {
        throw new Error("AI tidak menghasilkan kerangka bab.");
      }
      return { title, chapters };
    }
  );
  return parsed;
}

/**
 * Langkah 2: tulis SATU bab secara lengkap (output per-bab jauh lebih kecil
 * daripada meminta semua bab sekaligus, sehingga aman dari timeout).
 */
async function writeYoutubeChapter(
  text: string,
  timestampHints: string,
  outline: { title: string; topics: string[] },
  prefs: NotePreferences,
  previous: NoteChapter[]
): Promise<NoteChapter> {
  const prevText =
    previous.length > 0
      ? previous.map((c) => `- ${c.title}: ${c.content.slice(0, 300)}`).join("\n")
      : "(bab pertama)";

  const makePrompt = (compact: boolean) =>
    `Buat SATU bab dari catatan belajar tentang video YouTube berikut.

Judul bab: "${outline.title}"
Topik yang wajib dibahas:
${outline.topics.map((t) => `- ${t}`).join("\n")}

Subtitle video (seluruh isinya):
${text.slice(0, compact ? 12000 : 22000)}

${buildModeRules(prefs)}

${buildPreferencesText(prefs)}

${buildHumanizeRules(prefs)}

${buildChapterContentGuide(prefs)}

${
  timestampHints
    ? `Petunjuk timestamp (kira-kira posisi tiap bagian):\n${timestampHints}\n\n`
    : ""
}
${
  compact
    ? "MODE RINGKAS: tulis isi bab secara PADAT (150-250 kata), tetap lengkap & mudah dipahami, selesaikan semua topik."
    : "Isi bab HARUS lengkap & tuntas sesuai topik-topik di atas — jangan meninggalkan topik yang belum dibahas."
}
Bab yang sudah dibuat sebelumnya (jangan diulang):
${prevText}

Output HANYA JSON object, tanpa teks lain:
{"content": "isi bab lengkap dalam format yang dijelaskan di atas"}`;

  const write = (compact: boolean) =>
    aiChatJson<{ content: string }>(
      {
        system:
          "Kamu adalah penulis catatan belajar yang teliti. Tulis bab yang lengkap, jelas, terstruktur dari subtitle video. Jawab HANYA JSON object valid, tanpa markdown atau teks lain.",
        user: makePrompt(compact),
        json: true,
        maxTokens: compact ? 4000 : 9000,
        temperature: 0.35,
      },
      (raw) => {
        const obj = extractJsonObject(raw) as Record<string, unknown>;
        const content =
          typeof obj.content === "string" && obj.content.trim()
            ? obj.content.trim()
            : "";
        if (!content) throw new Error("AI tidak menghasilkan isi bab.");
        return { content };
      }
    );

  // Jika upstream sedang sibuk, bab normal bisa gagal terus → coba sekali lagi
  // dengan output kecil (lebih cepat & lebih jarang kena 502/timeout).
  let parsed;
  try {
    parsed = await write(false);
  } catch {
    parsed = await write(true);
  }

  return {
    id: previous.length + 1,
    title: outline.title,
    content: parsed.content,
  };
}

/**
 * Langkah 3: ringkasan eksekutif + poin penting dari bab-bab yang sudah jadi
 * (output kecil → aman dari timeout).
 */
async function summarizeChaptersAI(
  title: string,
  chapters: NoteChapter[],
  prefs: NotePreferences
): Promise<{ summary: string; keyPoints: string[] }> {
  const allContent = chapters.map((c) => c.content).join("\n\n");

  const parsed = await aiChatJson<{ summary?: string; keyPoints?: string[] }>(
    {
      system:
        "Kamu adalah perangkum catatan belajar. Jawab HANYA JSON object valid, tanpa teks lain.",
      user: `Buat ringkasan eksekutif 1-2 paragraf (4-6 kalimat) dan 4-6 poin penting dari catatan belajar "${title}" berikut:

${allContent.slice(0, 20000)}

- Bahasa: ${prefs.bahasa || "Bahasa Indonesia"}
- Gaya penulisan: ${prefs.gayaPenulisan || "Ramah & Santai"}

${buildHumanizeRules(prefs)}

Output JSON: {"summary": "...", "keyPoints": ["...", "..."]}`,
      json: true,
      maxTokens: 1600,
      temperature: 0.3,
    },
    (raw) => {
      const obj = extractJsonObject(raw) as Record<string, unknown>;
      const summary =
        typeof obj.summary === "string" && obj.summary.trim()
          ? obj.summary.trim().slice(0, 2000)
          : "";
      const keyPoints = Array.isArray(obj.keyPoints)
        ? (obj.keyPoints as unknown[])
            .map((k) => (typeof k === "string" ? k.trim() : ""))
            .filter(Boolean)
            .slice(0, 8)
        : [];
      return { summary, keyPoints };
    }
  );

  return {
    summary:
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : "",
    keyPoints: parsed.keyPoints ?? [],
  };
}

/**
 * Metode 1 (AI): subtitle → judul, ringkasan eksekutif, chapter lengkap,
 * poin penting. Dibuat bertahap (outline → tiap bab → ringkasan) agar setiap
 * panggilan AI berukuran kecil dan tidak gampang timeout/error.
 */
async function summarizeWithAI(
  text: string,
  segments?: TranscriptSegment[],
  prefs: NotePreferences = {},
  onProgress?: PhaseProgressFn
): Promise<ProcessedContent> {
  onProgress?.(0.08, "Membuat kerangka bab dengan AI...");
  const outline = await buildYoutubeOutline(text, prefs);

  const timestampHints = segments
    ? segments
        .slice(0, 12)
        .map((s) => `[${formatTimestamp(s.offsetMs)}] ${s.text.slice(0, 80)}`)
        .join("\n")
    : "";

  const chapters: NoteChapter[] = [];
  for (let i = 0; i < outline.chapters.length; i++) {
    const item = outline.chapters[i];
    onProgress?.(
      0.12 + (i / outline.chapters.length) * 0.78,
      `Menulis bab ${i + 1}/${outline.chapters.length}: ${item.title}`
    );
    try {
      const chapter = await writeYoutubeChapter(
        text,
        timestampHints,
        item,
        prefs,
        chapters
      );
      chapters.push(chapter);
    } catch (e) {
      // AI sibuk/kuota habis → gagalkan proses SEKARANG (jangan lanjut
      // menulis bab lain yang pasti gagal juga). Popup error akan muncul.
      if (isAiBusyError(e)) throw e;
      // Satu bab gagal (upstream sibuk) jangan menggagalkan SEMUA bab —
      // pakai cuplikan subtitle yang ringkas agar bab lain tetap hasil AI.
      const sentences = splitIntoSentences(text);
      const excerpt = sentences.slice(0, 8).join(" ").slice(0, 1200);
      chapters.push({
        id: chapters.length + 1,
        title: item.title,
        content:
          excerpt ||
          `(Bab "${item.title}" gagal ditulis AI — coba buat catatan lagi.)`,
      });
    }
  }

  onProgress?.(0.94, "Membuat ringkasan & poin penting...");
  const { summary, keyPoints } = await summarizeChaptersAI(
    outline.title || "Ringkasan Video",
    chapters,
    prefs
  );

  return {
    title: outline.title || "Ringkasan Video",
    summary: summary || chapters[0]?.content.slice(0, 220) || "",
    chapters,
    keyPoints,
  };
}

/** Metode 2 (fallback manual, tanpa AI): subtitle → struktur sederhana. */
export function parseSubtitleManually(
  text: string,
  segments?: TranscriptSegment[]
): ProcessedContent {
  const chapters = chaptersManually(text, segments);
  const firstChapter = chapters[0]?.content ?? text;
  const sentences = splitIntoSentences(firstChapter);
  const summary = sentences.slice(0, 2).join(" ");

  const keyPoints = chapters
    .map((c) => {
      const first = splitIntoSentences(c.content)[0];
      return first ? `${c.title}: ${first}` : c.title;
    })
    .slice(0, 6);

  return {
    title: makeTitle(text) || "Ringkasan Video",
    summary:
      summary.length > 0
        ? summary
        : text.slice(0, 220),
    chapters,
    keyPoints,
  };
}

/**
 * Proses subtitle YouTube menjadi ringkasan terstruktur.
 * useAI=true (default) → coba AI dulu, otomatis jatuh ke parsing manual
 * bila AI tidak tersedia atau gagal, agar user selalu dapat catatan.
 */
export async function processYouTubeSubtitle(
  subtitleText: string,
  segments?: TranscriptSegment[],
  prefs: NotePreferences = {},
  useAI: boolean = true,
  onProgress?: PhaseProgressFn
): Promise<ProcessedContent> {
  const clean = subtitleText.trim();
  if (clean.length === 0) {
    return {
      title: "Ringkasan Video",
      summary: "",
      chapters: [],
      keyPoints: [],
    };
  }

  if (useAI && hasAiKey() && clean.length > 400) {
    try {
      const result = await summarizeWithAI(clean, segments, prefs, onProgress);
      console.info(
        `[processYouTubeSubtitle] AI: ${result.chapters.length} bab, ${result.keyPoints.length} poin penting`
      );
      return result;
    } catch (e) {
      // AI sibuk/kuota habis → jangan jatuh ke subtitle mentah, biarkan
      // error naik ke job agar muncul popup "server sedang sibuk".
      if (isAiBusyError(e)) throw e;
      console.warn("[processYouTubeSubtitle] AI gagal, pakai parsing manual:", e);
    }
  } else if (useAI && !hasAiKey()) {
    console.warn("[processYouTubeSubtitle] Tanpa API key AI → parsing manual.");
  }

  onProgress?.(0.5, "Menyusun catatan secara manual...");
  const fallback = parseSubtitleManually(clean, segments);
  console.info(
    `[processYouTubeSubtitle] Manual: ${fallback.chapters.length} bab (ringkasan ekstraktif)`
  );
  return fallback;
}
