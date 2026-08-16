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
const MAX_PER_CHAPTER = 3;
const MAX_TOTAL = 15;
// Batas panjang segmen stabilo — enforce di kode (bukan hanya prompt) agar
// stabilo tetap berupa frasa/kalimat singkat, bukan paragraf utuh.
const MIN_TEXT_LENGTH = 6;
const MAX_TEXT_LENGTH = 120;

export interface HighlightCandidate {
  chapterId: number;
  text: string;
  color: HighlightColor;
}

/** Hasil resolusi kandidat → teks persis yang cocok di konten bab. */
interface ResolvedHighlight {
  chapterId: number;
  text: string;
  color: HighlightColor;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Cari potongan teks persis di dalam konten bab (case-insensitive, spasi
 * dinormalisasi). TIDAK ada fallback kata kunci — kandidat yang tidak cocok
 * persis diabaikan agar stabilo tidak muncul di kalimat lain yang mirip.
 */
function findExactInContent(text: string, content: string): string | null {
  const needle = normalize(text);
  const haystack = normalize(content);
  if (!needle) return null;
  const idx = haystack.toLowerCase().indexOf(needle.toLowerCase());
  if (idx >= 0) return haystack.slice(idx, idx + needle.length);
  return null;
}

/**
 * Pilih kandidat stabilo final dari daftar kandidat hasil AI:
 * 1. Cocokkan persis ke konten bab (findExactInContent) — kandidat yang tidak
 *    cocok dibuang.
 * 2. Buang yang di luar batas panjang (MIN/MAX_TEXT_LENGTH) — ukur dari teks
 *    persis hasil pencocokan, bukan panjang usulan AI.
 * 3. Anti-overlap per bab: kandidat yang lebih panjang diprioritaskan; kandidat
 *    yang terkandung dalam / mengandung highlight yang sudah dipilih pada bab
 *    yang sama dibuang (tidak ada sorotan bertumpuk).
 * 4. Kepadatan: maks MAX_PER_CHAPTER per bab & MAX_TOTAL per catatan, dengan
 *    distribusi merata antar-bab (bab yang kuotanya penuh dilewati, sisanya
 *    tetap diproses sampai total tercapai).
 *
 * Fungsi murni (tanpa DB) — mudah diuji.
 */
export function selectHighlights(
  candidates: HighlightCandidate[],
  chapters: NoteChapter[]
): ResolvedHighlight[] {
  // Langkah 1 & 2: cocokkan persis + batas panjang.
  const resolved: ResolvedHighlight[] = [];
  for (const candidate of candidates) {
    const chapter = chapters.find((ch) => ch.id === candidate.chapterId);
    if (!chapter) continue;
    const exact = findExactInContent(candidate.text, chapter.content);
    if (!exact) continue;
    if (exact.length < MIN_TEXT_LENGTH || exact.length > MAX_TEXT_LENGTH) {
      continue;
    }
    resolved.push({
      chapterId: candidate.chapterId,
      text: exact,
      color: candidate.color,
    });
  }

  // Kelompokkan per bab, urutkan dari yang terpanjang (prioritas anti-overlap).
  const byChapter = new Map<number, ResolvedHighlight[]>();
  for (const r of resolved) {
    const list = byChapter.get(r.chapterId) ?? [];
    list.push(r);
    byChapter.set(r.chapterId, list);
  }
  for (const list of byChapter.values()) {
    list.sort((a, b) => b.text.length - a.text.length);
  }

  // Langkah 3 & 4: pilih per bab dengan anti-overlap & kuota, round-robin
  // antar-bab agar distribusi merata.
  const chosen: ResolvedHighlight[] = [];
  const chosenTextByChapter = new Map<number, string[]>();
  const countByChapter = new Map<number, number>();

  // Sampai total tercapai, ambil 1 kandidat dari tiap bab yang masih punya
  // kuota, bergantian (round-robin).
  const chapterIds = [...byChapter.keys()];
  let cursor = 0;
  let progressed = true;
  while (chosen.length < MAX_TOTAL && progressed) {
    progressed = false;
    for (let k = 0; k < chapterIds.length; k++) {
      if (chosen.length >= MAX_TOTAL) break;
      const cid = chapterIds[(cursor + k) % chapterIds.length];
      const list = byChapter.get(cid) ?? [];
      if ((countByChapter.get(cid) ?? 0) >= MAX_PER_CHAPTER) continue;
      const taken = chosenTextByChapter.get(cid) ?? [];
      // Ambil kandidat terpanjang yang belum dipilih & tidak overlap.
      let picked: ResolvedHighlight | null = null;
      for (const cand of list) {
        const norm = normalize(cand.text);
        const overlaps = taken.some(
          (t) => t.includes(norm) || norm.includes(t)
        );
        if (!overlaps) {
          picked = cand;
          break;
        }
      }
      if (picked) {
        chosen.push(picked);
        chosenTextByChapter.set(cid, [...taken, normalize(picked.text)]);
        countByChapter.set(cid, (countByChapter.get(cid) ?? 0) + 1);
        byChapter.set(
          cid,
          list.filter((c) => c !== picked)
        );
        progressed = true;
      }
    }
    cursor++;
  }

  return chosen;
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

Pilih bagian-bagian PENTING untuk diberi stabilo (maksimal 3 per bab, total maksimal 15):
- "text": potongan teks yang PERSIS ada di konten — SALIN PERSIS apa adanya dari teks di atas, JANGAN parafrase, JANGAN mengubah/menambah/mengurangi kata. Boleh 1 kalimat utuh atau frasa kunci, panjang 6-120 karakter (idealnya 8-60).
- "chapterId": nomor bab tempat teks itu berasal.
- "color": "yellow" untuk poin penting/inti, "pink" untuk definisi/istilah/kunci, "blue" untuk contoh/data/fakta.
Prioritaskan kalimat yang berisi gagasan utama, bukan contoh bertele-tele. JANGAN menstabilo judul bab/heading.

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

  // Pilih kandidat final: cocok persis, batas panjang, anti-overlap, kepadatan
  // (lihat selectHighlights). Menyimpan teks PERSIS hasil pencocokan.
  const chosen = selectHighlights(candidates, chapters);

  let saved = 0;
  for (const item of chosen) {
    const entry = await addHighlight({
      noteId,
      chapterId: item.chapterId,
      text: item.text,
      color: item.color,
      userId: AI_USER_ID,
    });
    if (entry) saved++;
  }

  return saved;
}

/** Hapus stabilo AI tanpa generate ulang (dipakai endpoint). */
export { removeAiHighlights };
