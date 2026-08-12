/**
 * Fitur Regenerate (Buat Ulang) untuk catatan & bab:
 * AI menulis ulang satu bab atau seluruh catatan dari konten yang sudah ada,
 * lalu hasilnya disinkronkan kembali ke Supabase (chapters JSONB + chunks RAG).
 */
import { aiChatJson, extractJsonObject, hasAiKey } from "./ai";
import { chunkText } from "./rag/chunk";
import { embedTexts } from "./rag/embed";
import {
  replaceChunksForNote,
  updateNoteChapters,
} from "./rag/store";
import {
  CHAPTER_CONTENT_GUIDE,
  buildPreferencesText,
  type NotePreferences,
} from "./prompts/noteGeneration";
import type { Note, NoteChapter } from "./types";

export type { NotePreferences };

export interface RegenerateProgressFn {
  (percent: number, message: string): void;
}

const DEFAULT_PREFS: NotePreferences = {
  studyMode: "standar",
  gayaPenulisan: "Ramah & Santai",
  bahasa: "Bahasa Indonesia",
};

/**
 * Minta AI menulis ulang SATU bab. Konten bab lama dipakai sebagai sumber
 * acuan; instruksi opsional dari user (mis. "buat lebih ringkas") disisipkan.
 */
export async function rewriteChapterContent(
  note: Note,
  chapter: NoteChapter,
  instruction?: string,
  prefs: NotePreferences = DEFAULT_PREFS
): Promise<string> {
  if (!hasAiKey()) {
    throw new Error(
      "Regenerate butuh API key AI di .env.local (mis. OPENAGENTIC_API_KEY)."
    );
  }

  const prevChapters = (note.chapters ?? [])
    .filter((c) => c.id !== chapter.id)
    .map((c) => `- ${c.title}: ${c.content.slice(0, 200)}`)
    .join("\n") || "(tidak ada bab lain)";

  const prompt = `Buat ULANG SATU bab dari catatan belajar berikut agar hasilnya lebih baik dan sesuai keinginan pengguna.

Judul catatan: "${note.title}"
Judul bab: "${chapter.title}"

Konten bab saat ini (jadikan acuan utama, JANGAN mengubah fakta penting):
${chapter.content.slice(0, 22000)}

Bab lain dalam catatan (konteks, jangan diulang isinya):
${prevChapters}

${
  instruction && instruction.trim()
    ? `INSTRUKSI PENGUBAHAN DARI PENGGUNA (wajib dipatuhi):
${instruction.trim()}
`
    : ""
}

Preferensi catatan:
${buildPreferencesText(prefs)}

${CHAPTER_CONTENT_GUIDE}

Tulis bab baru yang lengkap & tuntas mengikuti instruksi pengguna di atas. Jangan menghilangkan topik penting dari konten lama kecuali diminta.

Output HANYA JSON object, tanpa teks lain:
{"content": "isi bab lengkap dalam format yang dijelaskan di atas"}`;

  const parsed = await aiChatJson<{ content?: unknown }>(
    {
      system:
        "Kamu adalah penulis catatan belajar yang teliti dan rapi. Tulis ulang bab dengan kualitas terbaik sesuai instruksi pengguna. Jawab HANYA JSON object valid, tanpa markdown atau teks lain.",
      user: prompt,
      json: true,
      maxTokens: 9000,
      temperature: 0.6,
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

  return String(parsed.content ?? "");
}

/** Rebuild seluruh chunks RAG dari konten bab terbaru (hapus lalu insert baru). */
export async function rebuildNoteChunks(
  noteId: string,
  chapters: NoteChapter[]
): Promise<void> {
  const pending: { chapterId: number; text: string }[] = [];
  for (const ch of chapters) {
    const texts = chunkText(ch.content || "", 800, 100);
    for (const t of texts) {
      pending.push({ chapterId: ch.id, text: t });
    }
  }

  if (pending.length === 0) return;

  const embeddings = await embedTexts(
    pending.map((p) => p.text),
    "passage"
  );

  await replaceChunksForNote(
    noteId,
    pending.map((p, i) => ({
      chapterId: p.chapterId,
      text: p.text,
      embedding: embeddings[i],
    }))
  );
}

/**
 * Regenerate SATU bab: AI menulis ulang → simpan chapters ke DB →
 * sinkronkan ulang chunks RAG.
 */
export async function regenerateChapter(
  note: Note,
  chapter: NoteChapter,
  instruction?: string,
  prefs?: NotePreferences,
  onProgress?: RegenerateProgressFn
): Promise<NoteChapter> {
  onProgress?.(10, "AI sedang memikirkan ulang bab ini...");
  const content = await rewriteChapterContent(note, chapter, instruction, prefs);
  onProgress?.(55, "Menyusun ulang bab...");

  const newChapters = (note.chapters ?? []).map((c) =>
    c.id === chapter.id ? { ...c, content } : c
  );

  await updateNoteChapters(note.id, newChapters);
  onProgress?.(75, "Menyinkronkan knowledge base...");
  await rebuildNoteChunks(note.id, newChapters);
  onProgress?.(100, "Selesai!");

  return { ...chapter, content };
}

/**
 * Regenerate SELURUH catatan: tulis ulang tiap bab satu per satu,
 * lalu simpan chapters + chunks.
 */
export async function regenerateAllChapters(
  note: Note,
  instruction?: string,
  prefs?: NotePreferences,
  onProgress?: RegenerateProgressFn
): Promise<NoteChapter[]> {
  const chapters = note.chapters ?? [];
  if (chapters.length === 0) {
    throw new Error("Catatan belum punya bab untuk ditulis ulang.");
  }

  const rewritten: NoteChapter[] = [];
  for (let i = 0; i < chapters.length; i++) {
    onProgress?.(
      Math.round((i / chapters.length) * 80) + 5,
      `Menulis ulang bab ${i + 1}/${chapters.length}: ${chapters[i].title}`
    );
    const content = await rewriteChapterContent(
      { ...note, chapters: [...rewritten, ...chapters.slice(i)] },
      chapters[i],
      instruction,
      prefs
    );
    rewritten.push({ ...chapters[i], content });
  }

  onProgress?.(88, "Menyinkronkan knowledge base...");
  await updateNoteChapters(note.id, rewritten);
  await rebuildNoteChunks(note.id, rewritten);
  onProgress?.(100, "Selesai! Catatan ditulis ulang.");

  return rewritten;
}
