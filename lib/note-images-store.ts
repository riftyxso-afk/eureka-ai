/**
 * Store Gambar Catatan (ilustrasi seperti buku) — Supabase.
 * Tabel: note_images
 */
import { db } from "./supabase/admin";

export type ImageAlignment = "left" | "center" | "right";
export type ImageSize = "small" | "medium" | "large";
export type ImageSource = "upload" | "web";

export interface NoteImage {
  id: string;
  noteId: string;
  chapterId?: number;
  url: string;
  caption?: string;
  alignment: ImageAlignment;
  size: ImageSize;
  source: ImageSource;
  position: number;
  createdAt: string;
}

function mapRow(row: any): NoteImage {
  return {
    id: row.id,
    noteId: row.note_id,
    chapterId: row.chapter_id ?? undefined,
    url: row.url,
    caption: row.caption ?? undefined,
    alignment: row.alignment,
    size: row.size,
    source: row.source,
    position: row.position,
    createdAt: row.created_at,
  };
}

/** Daftar gambar sebuah catatan (urut posisi). */
export async function listImages(noteId: string): Promise<NoteImage[]> {
  const client = db();
  const { data, error } = await client
    .from("note_images")
    .select("*")
    .eq("note_id", noteId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

/** Tambah satu gambar (upload user atau hasil scrape web). */
export async function addImage(
  input: Omit<NoteImage, "id" | "position" | "createdAt">
): Promise<NoteImage> {
  const client = db();
  const { data: maxRow } = await client
    .from("note_images")
    .select("position")
    .eq("note_id", input.noteId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (maxRow?.position ?? -1) + 1;

  const { data, error } = await client
    .from("note_images")
    .insert({
      note_id: input.noteId,
      chapter_id: input.chapterId ?? null,
      url: input.url,
      caption: input.caption ?? null,
      alignment: input.alignment,
      size: input.size,
      source: input.source,
      position,
    })
    .select()
    .single();

  if (error) throw error;
  return mapRow(data);
}

/** Hapus gambar; kembalikan URL-nya agar file ikut dihapus oleh pemanggil. */
export async function removeImage(
  noteId: string,
  imageId: string
): Promise<{ ok: boolean; url?: string }> {
  const client = db();
  const { data, error } = await client
    .from("note_images")
    .delete()
    .eq("id", imageId)
    .eq("note_id", noteId)
    .select("url");

  if (error) throw error;
  if (!data || data.length === 0) return { ok: false };
  return { ok: true, url: data[0].url };
}
