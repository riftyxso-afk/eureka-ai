/**
 * Store Highlight (stabilo) catatan — Supabase.
 * Tabel: highlights
 */
import { db } from "./supabase/admin";

export type HighlightColor = "yellow" | "pink" | "blue";

export interface HighlightEntry {
  id: string;
  noteId: string;
  chapterId: number;
  text: string;
  color: HighlightColor;
  userId: string;
  createdAt: string;
}

function mapRow(row: any): HighlightEntry {
  return {
    id: row.id,
    noteId: row.note_id,
    chapterId: row.chapter_id,
    text: row.text,
    color: row.color,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}

/** Daftar highlight sebuah catatan (opsional difilter per bab). */
export async function listHighlights(
  noteId: string,
  chapterId?: number
): Promise<HighlightEntry[]> {
  const client = db();
  let query = client
    .from("highlights")
    .select("*")
    .eq("note_id", noteId)
    .order("created_at", { ascending: false });
  if (chapterId != null) {
    query = query.eq("chapter_id", chapterId);
  }
  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

/** Tambah highlight (dedupe bila teks+chapter+warna sudah ada). */
export async function addHighlight(
  input: Omit<HighlightEntry, "id" | "createdAt">
): Promise<HighlightEntry | null> {
  const client = db();
  const key = input.text.trim().toLowerCase();

  const { data: dup } = await client
    .from("highlights")
    .select("id")
    .eq("note_id", input.noteId)
    .eq("chapter_id", input.chapterId)
    .eq("color", input.color)
    .ilike("text", key)
    .maybeSingle();
  if (dup) return null;

  const { data, error } = await client
    .from("highlights")
    .insert({
      note_id: input.noteId,
      chapter_id: input.chapterId,
      text: input.text.trim().slice(0, 500),
      color: input.color,
      user_id: input.userId,
    })
    .select()
    .single();

  if (error) throw error;
  return mapRow(data);
}

/** Hapus satu highlight. */
export async function removeHighlight(
  noteId: string,
  highlightId: string
): Promise<boolean> {
  const client = db();
  const { error } = await client
    .from("highlights")
    .delete()
    .eq("id", highlightId)
    .eq("note_id", noteId);

  if (error) throw error;
  return true;
}

/** Hapus semua highlight otomatis dari AI (untuk regenerasi stabilo). */
export async function removeAiHighlights(noteId: string): Promise<number> {
  const client = db();
  const { data, error } = await client
    .from("highlights")
    .delete()
    .eq("note_id", noteId)
    .eq("user_id", "ai")
    .select("id");

  if (error) throw error;
  return (data ?? []).length;
}
