/**
 * Stabilo otomatis dari AI: pilih kalimat-kalimat penting dari tiap bab dan
 * beri warna sesuai maknanya. Hasil disimpan ke store highlight yang sama
 * dengan stabilo manual (userId "ai"), sehingga langsung tampil di catatan.
 *
 * Warna: yellow = poin penting, pink = definisi/istilah, blue = contoh/fakta.
 */
import { aiChatJson, hasAiKey } from "./ai";
import { addHighlight, removeAiHighlights, type HighlightColor } from "./highlights-store";
import type { NoteChapter } from "./types";

const AI_USER_ID = "ai";
const MAX_PER_CHAPTER = 4;
const MAX_TOTAL = 24;

export interface HighlightCandidate {
  chapterId: number;
  text: string;
  color: HighlightColor;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Cari potongan teks persis di dalam konten bab (case-insensitive).
 * Kalau tidak cocok, coba potongan yang dipotong jadi kalimat pertama.
 */
function findExactInContent(text: string, content: string): string | null {
  const needle = normalize(text);
  const haystack = normalize(content);
  if (!needle) return null;
  const idx = haystack.toLowerCase().indexOf(needle.toLowerCase());
  if (idx >= 0) return haystack.slice(idx, idx + needle.length);

  // Coba kecocokan per kalimat: cari kalimat yang mengandung mayoritas kata kunci
  const keywords = needle.split(/\s+/).filter((w) => w.length > 2);
  if (keywords.length < 3) return null;
  const sentences = haystack.split(/(?<=[.!?])\s+/);
  let best: { sentence: string; score: number } | null = null;
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) score++;
    }
    if (!best || score > best.score) best = { sentence, score };
  }
  if (best && best.score >= Math.max(2, Math.ceil(keywords.length / 2))) {
    return best.sentence;
  }
  return null;
}

/**
 * Hasilkan stabilo untuk semua bab sebuah catatan.
 * Mengganti stabilo AI lama (regenerasi), menyimpan yang baru, dan
 * mengembalikan jumlah highlight yang berhasil disimpan.
 */
export async function generateHighlightsForChapters(
  noteId: string,
  chapters: NoteChapter[]
): Promise<number> {
  if (!hasAiKey()) {
    throw new Error(
      "Stabilo AI butuh API key di .env.local (mis. OPENAGENTIC_API_KEY)."
    );
  }

  const chapterList = chapters
    .map((c) => {
      const clean = normalize(c.content).slice(0, 6000);
      return `Bab ${c.id} — ${c.title}\n${clean}`;
    })
    .join("\n\n---\n\n")
    .slice(0, 30000);

  if (!chapterList.trim()) {
    throw new Error("Catatan tidak memiliki isi bab untuk distabilo.");
  }

  const candidates = await aiChatJson<HighlightCandidate[]>(
    {
      system:
        "Kamu adalah guru yang menandai bagian penting buku catatan dengan stabilo. Jawab HANYA dengan JSON array valid, tanpa markdown atau teks lain.",
      user: `Berikut isi catatan belajar yang sudah dibagi menjadi bab:

${chapterList}

Pilih bagian-bagian PENTING untuk diberi stabilo (maksimal 4 per bab, total maksimal 20):
- "text": potongan teks yang PERSIS ada di konten (boleh 1 kalimat utuh atau frasa kunci, 8-60 karakter). JANGAN membuat/mengubah kata.
- "chapterId": nomor bab tempat teks itu berasal.
- "color": "yellow" untuk poin penting/inti, "pink" untuk definisi/istilah/kunci, "blue" untuk contoh/data/fakta.
Prioritaskan kalimat yang berisi gagasan utama, bukan contoh bertele-tele.

Output HANYA JSON array, tanpa teks lain:
[{"chapterId": 1, "text": "potongan teks persis", "color": "yellow"}, ...]`,
      json: true,
      maxTokens: 9000,
      temperature: 0.2,
    },
    (raw) => {
      const clean = raw.replace(/```(?:json)?/gi, "").trim();
      const start = clean.indexOf("[");
      const end = clean.lastIndexOf("]");
      if (start === -1 || end === -1 || end <= start) {
        throw new Error("Respons AI tidak mengandung array JSON.");
      }
      const parsed = JSON.parse(clean.slice(start, end + 1)) as Record<string, unknown>[];
      if (!Array.isArray(parsed)) throw new Error("Respons AI bukan array.");
      return parsed
        .map((item) => ({
          chapterId: Number(item.chapterId),
          text: typeof item.text === "string" ? item.text.trim() : "",
          color: item.color === "pink" || item.color === "blue" ? item.color : "yellow",
        }))
        .filter(
          (c): c is HighlightCandidate =>
            Number.isInteger(c.chapterId) &&
            c.chapterId >= 1 &&
            c.text.length > 0 &&
            chapters.some((ch) => ch.id === c.chapterId)
        );
    }
  );

  await removeAiHighlights(noteId);

  const perChapter = new Map<number, number>();
  let saved = 0;
  for (const candidate of candidates) {
    const chapter = chapters.find((ch) => ch.id === candidate.chapterId);
    if (!chapter) continue;
    if ((perChapter.get(candidate.chapterId) ?? 0) >= MAX_PER_CHAPTER) continue;
    if (saved >= MAX_TOTAL) break;

    const exact = findExactInContent(candidate.text, chapter.content);
    if (!exact) continue;

    const entry = await addHighlight({
      noteId,
      chapterId: candidate.chapterId,
      text: exact,
      color: candidate.color,
      userId: AI_USER_ID,
    });
    if (entry) {
      perChapter.set(
        candidate.chapterId,
        (perChapter.get(candidate.chapterId) ?? 0) + 1
      );
      saved++;
    }
  }

  return saved;
}

/** Hapus stabilo AI tanpa generate ulang (dipakai endpoint). */
export { removeAiHighlights };
