import type { Note } from "./types";

export function normalizeDashboardNotes(value: unknown): Note[] {
  if (!Array.isArray(value)) throw new Error("Daftar catatan belum bisa dibaca.");
  const seen = new Set<string>();
  return value.flatMap(raw => {
    if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || !raw.id || seen.has(raw.id)) return [];
    seen.add(raw.id);
    return [{ ...raw, title: typeof raw.title === "string" && raw.title.trim() ? raw.title : "Catatan tanpa judul", summary: typeof raw.summary === "string" ? raw.summary : "", subject: typeof raw.subject === "string" ? raw.subject : "Umum", createdAt: typeof raw.createdAt === "string" && Number.isFinite(Date.parse(raw.createdAt)) ? raw.createdAt : "", pinned: raw.pinned === true } as Note];
  });
}

export function noteSource(note: Note) {
  if (/youtu\.be|youtube\.com/i.test(note.sourceUrl ?? "")) return "YouTube";
  if (note.sourceUrl) return "Web";
  return ["Dokumen", "Audio", "Video", "YouTube", "Web"].includes(note.subject) ? note.subject : "Catatan";
}
