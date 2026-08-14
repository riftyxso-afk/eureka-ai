/**
 * Pembangun konteks materi untuk kuis & flashcard dari chat asisten.
 *
 * Sumber materi = isi pesan percakapan sesi + konten catatan yang di-mention
 * ("@catatan") di sesi itu. Konteks dipotong agar biaya/latensi AI terkendali.
 *
 * Bagian pembangun teks (build*) sengaja MURNI (tanpa I/O) agar bisa diuji
 * lewat node:test tanpa jaringan; I/O hanya pada loadMentionedNotes.
 */
import type { AssistantChatMessage } from "./types.ts";
import { db } from "../supabase/admin.ts";

/** Total batas karakter konteks yang dikirim ke AI (sama dengan buildContext). */
export const STUDY_CONTEXT_LIMIT = 20000;

/** Label peran pesan (konsisten dengan tampilan chat). */
export const ROLE_LABELS: Record<"user" | "assistant", string> = {
  user: "Anda",
  assistant: "Eureka",
};

/**
 * Deteksi command alat belajar chat. Command harus sama persis (setelah
 * trim & lowercase) — "/kuis" / "/card". Teks lain (mis. "/kuis 10" atau
 * "buatkan kuis") TIDAK dianggap command agar tidak memicu popup liar.
 */
export function detectStudyCommand(text: string): "quiz" | "cards" | null {
  const q = text.trim().toLowerCase();
  if (q === "/kuis") return "quiz";
  if (q === "/card") return "cards";
  return null;
}

/**
 * Transkrip percakapan sesi → teks berlabel peran.
 * Pesan kosong dilewati; output dipotong maxChars dari AWAL (topik utama
 * biasanya ada di pesan-pesan awal).
 */
export function buildSessionContext(
  messages: Pick<AssistantChatMessage, "role" | "content">[],
  maxChars = 12000
): string {
  const parts: string[] = [];
  for (const m of messages) {
    const content = String(m.content ?? "").trim();
    if (!content) continue;
    parts.push(`${ROLE_LABELS[m.role]}:\n${content}`);
  }
  const joined = parts.join("\n\n");
  return joined.slice(0, Math.max(0, maxChars));
}

/** Konteks satu catatan: judul + bab (head 3 + tail 2, pola buildContext). */
export function buildNoteContext(notes: {
  title: string;
  chapters: { title: string; content: string }[];
}[]): string {
  const parts = notes.map((n) => {
    const chapters = n.chapters ?? [];
    if (chapters.length === 0) return n.title;
    const head = chapters
      .slice(0, 3)
      .map((c) => `${c.title}\n${c.content}`)
      .join("\n\n");
    const tail = chapters
      .slice(-2)
      .map((c) => `${c.title}\n${c.content}`)
      .join("\n\n");
    return `${n.title}\n\n${head}\n\n[...]\n\n${tail}`;
  });
  return parts.join("\n\n");
}

/**
 * Gabungkan transkrip sesi + materi catatan mention menjadi satu konteks,
 * dengan pemotongan proporsional: sesi dipotong maxChars, sisanya untuk
 * catatan, dan total dibatasi STUDY_CONTEXT_LIMIT.
 */
export function buildStudyContext(
  messages: Pick<AssistantChatMessage, "role" | "content">[],
  notes: {
    title: string;
    chapters: { title: string; content: string }[];
  }[],
  maxChars = STUDY_CONTEXT_LIMIT
): string {
  const sessionPart = buildSessionContext(messages, Math.floor(maxChars * 0.6));
  const notePart = buildNoteContext(notes).slice(0, maxChars - sessionPart.length);
  const parts: string[] = [];
  if (sessionPart) {
    parts.push(`===== PERCAKAPAN SESI =====\n${sessionPart}`);
  }
  if (notePart) {
    parts.push(`===== MATERI CATATAN =====\n${notePart}`);
  }
  return parts.join("\n\n").slice(0, maxChars);
}

/**
 * Muat materi catatan mention dari DB (service-role).
 * - Catatan dengan bab → judul + bab (materi utama).
 * - Catatan yang ada tapi belum punya bab → title-only (masih berguna).
 * - Catatan hilang → dilewati (tidak error).
 */
export async function loadMentionedNotes(noteIds: string[]): Promise<
  { title: string; chapters: { title: string; content: string }[] }[]
> {
  const ids = [...new Set(noteIds.map((s) => String(s).trim()).filter(Boolean))];
  if (ids.length === 0) return [];

  const { data, error } = await db()
    .from("notes")
    .select("id, title, chapters")
    .in("id", ids);
  if (error) {
    console.error("[studyContext] loadMentionedNotes", error);
    return [];
  }

  const byId = new Map(ids.map((id) => [id, id]));
  const found = (data ?? [])
    .filter((n) => byId.has(String(n.id)))
    .map((n) => ({
      title: String(n.title ?? "Catatan"),
      chapters: Array.isArray(n.chapters)
        ? (n.chapters as { title: string; content: string }[])
        : [],
    }));
  return found;
}

/** Kumpulkan semua id catatan yang di-mention di seluruh pesan sesi. */
export function collectMentionIds(
  messages: Pick<AssistantChatMessage, "mentions">[]
): string[] {
  const ids: string[] = [];
  for (const m of messages) {
    for (const id of m.mentions ?? []) {
      const s = String(id).trim();
      if (s && !ids.includes(s)) ids.push(s);
    }
  }
  return ids;
}
