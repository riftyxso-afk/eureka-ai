/**
 * Store Papan Tulis kolaboratif — Supabase.
 * Tabel: whiteboards (per catatan) + board_strokes
 */
import { db } from "./supabase/admin";

export interface BoardStroke {
  id: string;
  authorId: string;
  authorName: string;
  color: string;
  size: number;
  /** Titik [x, y] dalam koordinat logis papan. */
  points: number[][];
  createdAt: string;
}

interface BoardData {
  strokes: BoardStroke[];
  /** Timestamp terakhir papan dibersihkan (untuk sinkronisasi clear). */
  clearedAt: number;
}

function mapStroke(row: any): BoardStroke {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    color: row.color,
    size: row.size,
    points: row.points ?? [],
    createdAt: row.created_at,
  };
}

export async function getBoard(noteId: string): Promise<BoardData> {
  const client = db();
  const { data: meta } = await client
    .from("whiteboards")
    .select("cleared_at")
    .eq("note_id", noteId)
    .maybeSingle();

  const { data: strokes, error } = await client
    .from("board_strokes")
    .select("*")
    .eq("note_id", noteId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return {
    strokes: (strokes ?? []).map(mapStroke),
    clearedAt: meta?.cleared_at ?? 0,
  };
}

export async function addBoardStroke(
  noteId: string,
  stroke: Omit<BoardStroke, "id" | "createdAt">
): Promise<BoardStroke> {
  const client = db();
  const { data, error } = await client
    .from("board_strokes")
    .insert({
      note_id: noteId,
      author_id: stroke.authorId,
      author_name: stroke.authorName,
      color: stroke.color,
      size: stroke.size,
      points: stroke.points,
    })
    .select()
    .single();

  if (error) throw error;

  // Batasi jumlah goresan agar tabel tidak membengkak.
  const { count } = await client
    .from("board_strokes")
    .select("id", { count: "exact", head: true })
    .eq("note_id", noteId);
  if ((count ?? 0) > 3000) {
    const { data: oldest } = await client
      .from("board_strokes")
      .select("id")
      .eq("note_id", noteId)
      .order("created_at", { ascending: true })
      .limit(Math.max(0, (count ?? 0) - 2500));
    if (oldest && oldest.length > 0) {
      await client
        .from("board_strokes")
        .delete()
        .in(
          "id",
          oldest.map((o) => o.id)
        );
    }
  }

  return mapStroke(data);
}

export async function clearBoard(noteId: string): Promise<number> {
  const client = db();
  const clearedAt = Date.now();

  await client.from("board_strokes").delete().eq("note_id", noteId);
  await client.from("whiteboards").upsert({
    note_id: noteId,
    cleared_at: clearedAt,
  });

  return clearedAt;
}
