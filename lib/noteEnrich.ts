/**
 * Enrichment pasca-rangkum: setelah catatan dibuat dari materi apa pun
 * (YouTube, dokumen, audio, video), cari informasi terkait di web via
 * Firecrawl untuk memvalidasi & memperkaya hasil, plus sisipkan gambar
 * yang relevan + poin penting tambahan — semuanya otomatis, tanpa user.
 *
 * Melewatkan (no-op) bila FIRECRAWL_API_KEY belum diisi di .env.local.
 */
import { aiChatJson } from "./ai";
import { isFirecrawlConfigured, scrapeWebUrl, searchWeb, type WebImage } from "./firecrawl";
import { uploadNoteImage } from "./noteImageStorage";
import type { Note, NoteChapter } from "./types";

const MAX_PLACED_IMAGES = 4;
const MAX_IMAGES_PER_CHAPTER = 2;

export interface EnrichedNote {
  note: Note;
  imagesPlaced: number;
  keyPointsAdded: number;
}

/**
 * Unduh gambar → unggah ke Supabase Storage (URL publik permanen,
 * lintas-instance — tidak lagi ke disk lokal yang hilang saat redeploy
 * dan tidak terbaca frontend Vercel) → kembalikan peta URL.
 */
async function downloadImagesToNote(
  noteId: string,
  images: { url: string; alt: string }[]
): Promise<Map<string, string>> {
  const localMap = new Map<string, string>();
  let index = 0;

  for (const img of images) {
    if (index >= MAX_PLACED_IMAGES) break;
    try {
      const res = await fetch(img.url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/")) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (!buffer.length || buffer.length > 4 * 1024 * 1024) continue;
      const extMatch = img.url.split("?")[0].match(/\.(png|jpe?g|webp|gif)$/i);
      const fallback: Record<string, string> = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
        "image/gif": "gif",
      };
      const ext =
        (extMatch?.[1] ?? "").toLowerCase() ||
        fallback[contentType] ||
        "jpg";
      const filename = `enrich-${++index}.${ext}`;
      const url = await uploadNoteImage(
        noteId,
        filename,
        buffer,
        contentType.split(";")[0] || `image/${ext === "jpg" ? "jpeg" : ext}`
      );
      // Gagal unggah → jangan sisipkan markdown yang akan rusak.
      if (!url) {
        index--;
        continue;
      }
      localMap.set(img.url, url);
    } catch {
      // gambar gagal → dilewati
    }
  }
  return localMap;
}

function buildQuery(note: Note): string {
  const parts = [note.title];
  const chapterTitles = (note.chapters ?? [])
    .slice(0, 3)
    .map((c) => c.title)
    .filter((t) => t && t !== "Pembahasan Utama");
  parts.push(...chapterTitles);
  return parts.join(" ");
}

/**
 * Bentuk catatan yang sudah diperkaya (clone). Mengembalikan null saat
 * tidak perlu/mampu enrich (tanpa key Firecrawl, tanpa bab, dll).
 */
export async function enrichNoteWithFirecrawl(note: Note): Promise<EnrichedNote | null> {
  const chapters = note.chapters ?? [];
  if (chapters.length === 0) return null;
  if (!isFirecrawlConfigured()) return null;

  const query = buildQuery(note);
  if (!query) return null;

  // 1) Cari materi terkait
  const results = await searchWeb(query, 2);
  let scrapedText = "";
  const availableImages: WebImage[] = [];

  // 2) Scrape hasil teratas & kumpulkan gambar yang relevan
  for (const result of results.slice(0, 2)) {
    try {
      const scraped = await scrapeWebUrl(result.url);
      scrapedText += (scrapedText ? "\n\n" : "") + scraped.text.slice(0, 7000);
      availableImages.push(...scraped.images.slice(0, 6));
    } catch {
      // hasil ini gagal di-scrape → lanjut
    }
  }

  const imagePool = availableImages.slice(0, 12);
  if (!scrapedText.trim()) return null;

  // 3) AI menentukan gambar relevan + poin penting tambahan
  const chapterList = chapters
    .map((c) => `Bab ${c.id} — ${c.title}\n${c.content.slice(0, 1500)}`)
    .join("\n\n")
    .slice(0, 22000);

  const parsed = await aiChatJson<{
    extraKeyPoints?: unknown;
    placements?: unknown;
  }>(
    {
      system:
        "Kamu adalah guru yang memvalidasi catatan belajar dengan sumber tambahan dari web. Jawab HANYA JSON object valid, tanpa markdown atau teks lain.",
      user: `Berikut catatan belajar yang sudah dibuat siswa:

${chapterList}

Dan berikut teks dari sumber web TAMBAHAN yang relevan dengan materi (untuk validasi):

${scrapedText.trim().slice(0, 12000)}

Gambar yang TERSEDIA dari sumber tersebut (hanya ini yang boleh dipakai):
${imagePool.length > 0
    ? imagePool
        .map((img, i) => `${i + 1}. ${img.alt || "tanpa keterangan"} → ${img.url}`)
        .join("\n")
    : "(tidak ada gambar)"}

Tugas:
1. "extraKeyPoints": 2-4 fakta/poin penting dari sumber tambahan yang BELUM ada di catatan (tidak mengulang, valid & akurat, satu kalimat per poin).
2. "placements": pilih maksimal ${MAX_PLACED_IMAGES} gambar yang PALING relevan untuk melengkapi bab tertentu. Setiap item: {"chapterId": <nomor bab>, "url": "<URL gambar persis dari daftar>", "caption": "<keterangan deskriptif>"}. Maksimal ${MAX_IMAGES_PER_CHAPTER} gambar per bab. Kosongkan array jika tidak ada gambar relevan.
Jangan memasukkan fakta yang tidak didukung sumber tambahan.

Output HANYA JSON object, tanpa teks lain:
{"extraKeyPoints": ["...", "..."], "placements": [{"chapterId": 1, "url": "...", "caption": "..."}]}`,
      json: true,
      maxTokens: 4500,
      temperature: 0.2,
    },
    (raw) => {
      const obj = JSON.parse(
        raw.replace(/```(?:json)?/gi, "").trim()
      ) as Record<string, unknown>;
      const extraKeyPoints = Array.isArray(obj.extraKeyPoints)
        ? obj.extraKeyPoints
            .map((k) => (typeof k === "string" ? k.trim() : ""))
            .filter(Boolean)
            .slice(0, 4)
        : [];
      const placements = Array.isArray(obj.placements)
        ? obj.placements
            .map((p) => p as Record<string, unknown>)
            .filter((p) => p && typeof p === "object")
            .map((p) => ({
              chapterId: Number(p.chapterId),
              url: typeof p.url === "string" ? p.url.trim() : "",
              caption:
                typeof p.caption === "string" && p.caption.trim()
                  ? p.caption.trim().slice(0, 120)
                  : "Ilustrasi materi",
            }))
            .filter(
              (p) =>
                Number.isInteger(p.chapterId) &&
                chapters.some((c) => c.id === p.chapterId) &&
                imagePool.some((img) => img.url === p.url)
            )
            .slice(0, MAX_PLACED_IMAGES)
        : [];
      return { extraKeyPoints, placements };
    }
  );

  const placements = Array.isArray(parsed.placements)
    ? parsed.placements
    : [];
  const extraKeyPoints = Array.isArray(parsed.extraKeyPoints)
    ? parsed.extraKeyPoints
    : [];

  // 4) Unduh gambar → peta URL lokal → sisipkan ke bab yang dipilih
  const localMap = await downloadImagesToNote(
    note.id,
    placements.map((p) => ({ url: p.url, alt: p.caption }))
  );

  const perChapter = new Map<number, number>();
  let imagesPlaced = 0;
  const enrichedChapters = chapters.map((chapter) => {
    const picks = placements.filter((p) => p.chapterId === chapter.id);
    let content = chapter.content.trim();
    for (const pick of picks.slice(0, MAX_IMAGES_PER_CHAPTER)) {
      const local = localMap.get(pick.url);
      if (!local) continue;
      if ((perChapter.get(chapter.id) ?? 0) >= MAX_IMAGES_PER_CHAPTER) continue;
      content += `\n\n![${pick.caption}](${local})`;
      perChapter.set(chapter.id, (perChapter.get(chapter.id) ?? 0) + 1);
      imagesPlaced++;
    }
    return { ...chapter, content };
  });

  const keyPointsAdded = extraKeyPoints.length;
  const enrichedNote: Note = {
    ...note,
    chapters: enrichedChapters as NoteChapter[],
    keyPoints: [...(note.keyPoints ?? []), ...extraKeyPoints].slice(0, 10),
  };

  return { note: enrichedNote, imagesPlaced, keyPointsAdded };
}