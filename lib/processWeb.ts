/**
 * Mengubah hasil scrape halaman web menjadi catatan belajar lengkap:
 * bab dibuat SATU PER SATU oleh AI agar rapi & lengkap, dengan ilustrasi
 * (gambar dari halaman sumber) yang disisipkan langsung ke tiap bab,
 * dan mengikuti preferensi Atur Catatan (mode belajar, gaya penulisan, bahasa).
 */
import type { NoteChapter } from "./types";
import { aiChatJson, hasAiKey } from "./ai";
import type { WebImage } from "./firecrawl";
import type { ProcessedContent } from "./processSubtitle";
import type { PhaseProgressFn } from "./progressTracker";
import {
  CHAPTER_CONTENT_GUIDE,
  IMAGE_PLACEMENT_RULES,
  buildImageGuide,
  buildPreferencesText,
  type NotePreferences,
} from "./prompts/noteGeneration";
import { promises as fs } from "fs";
import path from "path";

const MAX_CHAPTERS = 8;
const MAX_IMAGES_PER_CHAPTER = 3;

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

export type WebPreferences = NotePreferences;

function outlinePrompt(text: string): string {
  return `Berikut adalah isi sebuah halaman web yang akan dijadikan catatan belajar:

${text.slice(0, 22000)}

Buat kerangka (outline) 4-8 bab berdasarkan topik-topik utama halaman tersebut.
Untuk tiap bab berikan:
- "title": judul singkat & jelas (maksimal 8 kata)
- "topics": 2-4 topik kunci yang harus dibahas di bab itu (1 baris per topik)

Output HANYA JSON array, tanpa teks lain:
[{"title": "Judul Bab 1", "topics": ["topik 1", "topik 2"]}, ...]`;
}

async function generateOutline(
  text: string
): Promise<{ title: string; topics: string[] }[]> {
  const raw = await aiChatJson<
    { title: string; topics: string[] }[]
  >(
    {
      system:
        "Kamu adalah perencana catatan belajar. Selalu jawab dengan JSON array yang valid, tanpa markdown atau teks lain.",
      user: outlinePrompt(text),
      json: true,
      maxTokens: 4000,
      temperature: 0.3,
    },
    (raw) => {
      const parsed = extractJsonArray(raw);
      if (!Array.isArray(parsed)) throw new Error("Respons AI bukan array.");
      return parsed
        .map((item: Record<string, unknown>) => ({
          title:
            typeof item.title === "string" && item.title.trim()
              ? item.title.trim()
              : "Bab",
          topics: Array.isArray(item.topics)
            ? item.topics
                .map((t) => (typeof t === "string" ? t.trim() : ""))
                .filter(Boolean)
                .slice(0, 4)
            : [],
        }))
        .filter((c) => c.title && c.title !== "Bab")
        .slice(0, MAX_CHAPTERS);
    }
  );
  return raw;
}

function chapterPrompt(
  text: string,
  outline: { title: string; topics: string[] },
  images: WebImage[],
  prefs: WebPreferences,
  previousChapters: NoteChapter[]
): string {
  const prevText =
    previousChapters.length > 0
      ? previousChapters
          .map((c) => `- ${c.title}: ${c.content.slice(0, 300)}`)
          .join("\n")
      : "(bab pertama)";

  return `Buat SATU bab dari catatan belajar tentang halaman web berikut.

Judul bab: "${outline.title}"
Topik yang harus dibahas:
${outline.topics.map((t) => `- ${t}`).join("\n")}

Sumber halaman web (seluruh isinya):
${text.slice(0, 22000)}

Gambar yang TERSEDIA dari halaman ini (hanya ini yang boleh dipakai):
${buildImageGuide(images)}

${IMAGE_PLACEMENT_RULES}

Preferensi catatan:
${buildPreferencesText(prefs)}

${CHAPTER_CONTENT_GUIDE}

Isi bab HARUS lengkap & tuntas sesuai topik-topik di atas — jangan meninggalkan topik yang belum dibahas.
Bab yang sudah dibuat sebelumnya (jangan diulang):
${prevText}

Output HANYA JSON object, tanpa teks lain:
{"content": "isi bab lengkap dalam format yang dijelaskan di atas"}`;
}

async function generateChapter(
  text: string,
  outline: { title: string; topics: string[] },
  images: WebImage[],
  prefs: WebPreferences,
  previousChapters: NoteChapter[]
): Promise<string> {
  const parsed = await aiChatJson<{ content?: unknown }>(
    {
      system:
        "Kamu adalah penulis catatan belajar yang teliti dan rapi. Tulis bab yang lengkap, jelas, terstruktur, dan memakai gambar dari daftar yang tersedia bila relevan. Jawab HANYA JSON object valid, tanpa markdown atau teks lain.",
      user: chapterPrompt(text, outline, images, prefs, previousChapters),
      json: true,
      maxTokens: 9000,
      temperature: 0.35,
    },
    (raw) => {
      const obj = JSON.parse(
        raw.replace(/```(?:json)?/gi, "").trim()
      ) as Record<string, unknown>;
      if (!obj || typeof obj !== "object") {
        throw new Error("Respons AI bukan objek.");
      }
      const content =
        typeof obj.content === "string" && obj.content.trim()
          ? obj.content.trim()
          : "";
      if (!content) throw new Error("AI tidak menghasilkan isi bab.");
      return { content };
    }
  );
  return String(parsed.content ?? "");
}

/** Hapus marker gambar yang tidak valid/di luar daftar agar bab tetap rapi. */
function sanitizeImages(content: string, images: WebImage[]): string {
  const allowed = new Set(images.map((i) => i.url));
  return content.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g,
    (m, alt: string, url: string) =>
      allowed.has(url) ? m : `*${alt || "ilustrasi"}*`
  );
}

/** Batasi jumlah gambar per bab (maks 3) agar tidak penuh. */
function capImagesPerChapter(content: string): string {
  const re = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) matches.push(m[0]);
  if (matches.length <= MAX_IMAGES_PER_CHAPTER) return content;
  const keep = new Set(matches.slice(0, MAX_IMAGES_PER_CHAPTER).map((m) => m[0]));
  return content.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g,
    (m, alt: string) => (keep.has(m) ? m : `*${alt || "ilustrasi"}*`)
  );
}

/**
 * Proses halaman web menjadi catatan: outline → bab demi bab (AI) →
 * gambar disisipkan → ringkasan + poin penting.
 */
export async function processWebPageToChapters(
  text: string,
  images: WebImage[],
  prefs: WebPreferences = {},
  onProgress?: PhaseProgressFn
): Promise<ProcessedContent> {
  const clean = text.trim();
  if (clean.length < 120) {
    return {
      title: "Catatan dari Web",
      summary: clean,
      chapters: [
        {
          id: 1,
          title: "Pembahasan Utama",
          content: clean,
        },
      ],
      keyPoints: [],
    };
  }

  if (!hasAiKey()) {
    throw new Error(
      "Catatan dari web butuh API key AI di .env.local (mis. OPENAGENTIC_API_KEY)."
    );
  }

  onProgress?.(0.08, "Membuat kerangka bab dari halaman web...");
  const outline = await generateOutline(clean);
  if (outline.length === 0) {
    throw new Error("AI tidak menghasilkan kerangka bab.");
  }

  const chapters: NoteChapter[] = [];
  for (let i = 0; i < outline.length; i++) {
    const item = outline[i];
    onProgress?.(
      0.12 + (i / outline.length) * 0.78,
      `Menulis bab ${i + 1}/${outline.length}: ${item.title}`
    );
    let content = await generateChapter(clean, item, images, prefs, chapters);
    content = sanitizeImages(content, images);
    content = capImagesPerChapter(content);
    chapters.push({
      id: chapters.length + 1,
      title: item.title,
      content,
    });
  }

  onProgress?.(0.94, "Membuat ringkasan & poin penting...");
  const allContent = chapters.map((c) => c.content).join("\n\n");
  const parsed = await aiChatJson<{ summary?: string; keyPoints?: string[] }>(
    {
      system:
        "Kamu adalah perangkum catatan belajar. Jawab HANYA JSON object valid, tanpa teks lain.",
      user: `Buat ringkasan eksekutif 2-4 kalimat (bahasa ${prefs.bahasa ?? "Indonesia"}) dan 4-6 poin penting dari catatan berikut:

${allContent.slice(0, 20000)}

Output JSON: {"summary": "...", "keyPoints": ["...", "..."]}`,
      json: true,
      maxTokens: 1200,
      temperature: 0.3,
    },
    (raw) => {
      const obj = JSON.parse(
        raw.replace(/```(?:json)?/gi, "").trim()
      ) as Record<string, unknown>;
      const summary =
        typeof obj.summary === "string" && obj.summary.trim()
          ? obj.summary.trim().slice(0, 2000)
          : "";
      const keyPoints = Array.isArray(obj.keyPoints)
        ? obj.keyPoints
            .map((k) => (typeof k === "string" ? k.trim() : ""))
            .filter(Boolean)
            .slice(0, 8)
        : [];
      return { summary, keyPoints };
    }
  );

  return {
    title: "",
    summary: parsed.summary || allContent.slice(0, 220),
    chapters,
    keyPoints: parsed.keyPoints ?? [],
  };
}

const IMAGE_MARKER_RE = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;

/** Unduh gambar web yang dipakai AI di bab → simpan lokal (public/images/notes/<noteId>/). */
export async function downloadWebImages(
  noteId: string,
  chapters: NoteChapter[]
): Promise<NoteChapter[]> {
  const dir = path.join(process.cwd(), "public", "images", "notes", noteId);
  const usedUrls = new Set<string>();

  for (const chapter of chapters) {
    const re = new RegExp(IMAGE_MARKER_RE.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(chapter.content)) !== null) usedUrls.add(m[2]);
  }

  const localMap = new Map<string, string>();
  let index = 0;
  const urls = Array.from(usedUrls);
  for (let u = 0; u < urls.length; u++) {
    const url = urls[u];
    if (index >= 8) break;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/")) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (!buffer.length || buffer.length > 4 * 1024 * 1024) continue;
      const ext = (url.split("?")[0].match(/\.(png|jpe?g|webp|gif)$/i)?.[1] ?? "").toLowerCase();
      const fallback = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" } as Record<string, string>;
      const finalExt = ext || fallback[contentType] || "jpg";
      const filename = `web-${++index}.${finalExt}`;
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, filename), buffer);
      localMap.set(url, `/images/notes/${noteId}/${filename}`);
    } catch {
      // gambar gagal diunduh → biarkan marker diganti teks di bawah
    }
  }

  if (localMap.size === 0) {
    // Tidak ada gambar berhasil diunduh → buang semua marker biar bab rapi
    return chapters.map((c) => ({
      ...c,
      content: c.content.replace(IMAGE_MARKER_RE, "*ilustrasi*").trim(),
    }));
  }

  return chapters.map((c) => ({
    ...c,
    content: c.content
      .replace(IMAGE_MARKER_RE, (_m, alt: string, src: string) => {
        const local = localMap.get(src);
        return local ? `![${alt}](${local})` : `*${alt || "ilustrasi"}*`;
      })
      .trim(),
  }));
}
