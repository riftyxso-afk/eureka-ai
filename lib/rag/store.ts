/**
 * Supabase Integration for RAG (Retrieval Augmented Generation)
 * Complete migration from local file system to Supabase database
 */

import { db } from '../supabase/admin';
import type { Note, NoteChapter } from '../types';

interface StoredChunk {
  id: string;
  noteId: string;
  text: string;
  embedding: number[];
}

export type { StoredChunk };

interface SupabaseNote extends Omit<Note, 'chunks'> {
  chunks?: any[];
}

/**
 * Cosine similarity calculation (client-side fallback)
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return -1;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (!denom) return 0;
  return dot / denom;
}

interface NoteSearchResult {
  score: number;
  text: string;
  noteTitle: string;
  noteSubject: string;
  chunkId: string;
}

/**
 * Save a note with its chunks to Supabase
 */
export async function saveNoteWithChunks(
  note: Note & { user_id?: string },
  chunks: StoredChunk[],
  chapterId: number = 0
): Promise<Note> {
  try {
    // First, insert the note
    if (!note.user_id) {
      throw new Error("user_id wajib diisi agar catatan tersimpan.");
    }
    const { data: savedNote, error: noteError } = await db()
      .from('notes')
      .insert({
        id: note.id,
        title: note.title,
        summary: note.summary,
        subject: note.subject ?? null,
        user_id: note.user_id,
        note_type: note.noteType ?? 'rangkuman',
        chapters: note.chapters ?? [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (noteError) throw noteError;

    // Then, insert all chunks with embeddings
    const chunkRecords = chunks.map((chunk) => ({
      note_id: note.id,
      chapter_id: chapterId,
      text: chunk.text.trim(),
      // pgvector butuh format string "[0.1,0.2,...]"
      embedding: chunk.embedding
        ? `[${chunk.embedding.map((n) => n.toFixed(6)).join(",")}]`
        : null,
    }));

    if (chunkRecords.length > 0) {
      const { error: chunksError } = await db()
        .from('chunks')
        .insert(chunkRecords);

      if (chunksError) throw chunksError;
    }

    return savedNote as Note;
  } catch (error) {
    console.error('[saveNoteWithChunks] Error:', error);
    throw error;
  }
}

/**
 * List notes for a user (isolasi per-user: tanpa userId = catatan semua user)
 */
export async function listNotes(userId?: string): Promise<Note[]> {
  try {
    let query = db()
      .from('notes')
      .select('*')
      .order('updated_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) throw error;
    
    // Filter out private fields
    return (data ?? []).map(n => ({
      id: n.id,
      title: n.title,
      summary: n.summary,
      subject: n.subject,
      noteType: n.note_type ?? 'rangkuman',
      createdAt: n.created_at,
      updatedAt: n.updated_at,
      pinned: n.pinned === true,
      chunks: [],
    }));
  } catch (error) {
    console.error('[listNotes] Error:', error);
    throw error;
  }
}

/**
 * Update a note's title and/or summary
 */
export async function updateNote(
  noteId: string,
  patch: Partial<Pick<Note, "title" | "summary" | "pinned">>
): Promise<Note | null> {
  try {
    const { data, error } = await db()
      .from('notes')
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq('id', noteId)
      .select()
      .single();

    if (error) throw error;

    return data as Note;
  } catch (error) {
    console.error('[updateNote] Error:', error);
    throw error;
  }
}

/**
 * Get a note with its chunks
 */
export async function getNoteWithChunks(
  noteId: string
): Promise<{ note: Note; chunks: any[] } | null> {
  try {
    // Get note
    const { data: note, error: noteError } = await db()
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .single();

    if (noteError || !note) return null;

    // Get chunks
    const { data: chunks, error: chunksError } = await db()
      .from('chunks')
      .select('*')
      .eq('note_id', noteId)
      .order('chapter_id', { ascending: true });

    if (chunksError) throw chunksError;

    return {
      note: {
        id: note.id,
        title: note.title,
        summary: note.summary,
        subject: note.subject,
        user_id: note.user_id ?? null,
        noteType: note.note_type ?? 'rangkuman',
        chapters: note.chapters ?? [],
        createdAt: note.created_at,
        updatedAt: note.updated_at,
        pinned: note.pinned === true,
        chunks: chunks ?? [],
      } as Note,
      chunks: chunks ?? [],
    };
  } catch (error) {
    console.error('[getNoteWithChunks] Error:', error);
    throw error;
  }
}

/**
 * Delete a note (cascade deletes will handle chunks)
 */
export async function deleteNote(noteId: string): Promise<void> {
  try {
    const { error } = await db()
      .from('notes')
      .delete()
      .eq('id', noteId);

    if (error) throw error;
  } catch (error) {
    console.error('[deleteNote] Error:', error);
    throw error;
  }
}

/**
 * Update chapters JSONB + timestamp untuk note yang sudah ada
 * (dipakai fitur regenerate bab/catatan).
 */
export async function updateNoteChapters(
  noteId: string,
  chapters: NoteChapter[]
): Promise<void> {
  try {
    const { error } = await db()
      .from('notes')
      .update({
        chapters,
        updated_at: new Date().toISOString(),
      })
      .eq('id', noteId);

    if (error) throw error;
  } catch (error) {
    console.error('[updateNoteChapters] Error:', error);
    throw error;
  }
}

/**
 * Hapus semua chunks note lalu buat ulang dari konten bab (RAG tetap sinkron
 * setelah regenerate). Embedding dipasok pemanggil agar satu batch embedding.
 */
export async function replaceChunksForNote(
  noteId: string,
  chunks: {
    chapterId: number;
    text: string;
    embedding: number[];
  }[]
): Promise<void> {
  try {
    const { error: delError } = await db()
      .from('chunks')
      .delete()
      .eq('note_id', noteId);

    if (delError) throw delError;

    if (chunks.length === 0) return;

    const records = chunks.map((c) => ({
      note_id: noteId,
      chapter_id: c.chapterId,
      text: c.text.trim(),
      // pgvector butuh format string "[0.1,0.2,...]"
      embedding: `[${c.embedding.map((n) => n.toFixed(6)).join(",")}]`,
    }));

    const { error: insError } = await db().from('chunks').insert(records);
    if (insError) throw insError;
  } catch (error) {
    console.error('[replaceChunksForNote] Error:', error);
    throw error;
  }
}

/**
 * Update chunk embeddings (usually done by background job)
 */
export async function updateChunksEmbeddings(noteId: string, embeddings: number[][]): Promise<void> {
  try {
    const { data: chunks } = await db()
      .from('chunks')
      .select('id')
      .eq('note_id', noteId)
      .order('id');

    if (!chunks || chunks.length !== embeddings.length) {
      throw new Error('Number of embeddings does not match number of chunks');
    }

    // Update each chunk's embedding
    for (const [index, embedding] of embeddings.entries()) {
      await db()
        .from('chunks')
        .update({ embedding: embedding })
        .eq('id', chunks[index].id);
    }

    console.log(`[updateChunksEmbeddings] Updated ${embeddings.length} embeddings for note ${noteId}`);
  } catch (error) {
    console.error('[updateChunksEmbeddings] Error:', error);
    throw error;
  }
}

/**
 * Search chunks using vector similarity
 */
export async function searchChunks(
  queryEmbedding: number[],
  topK: number = 3,
  noteId?: string,
  userId?: string
): Promise<NoteSearchResult[]> {
  try {
    // Use Supabase RPC function match_chunks
    const { data, error } = await db().rpc('match_chunks', {
      query_embedding: queryEmbedding as number[],
      p_note_id: noteId,
      similarity_threshold: 0.78,
      top_k: topK,
      filter_user_id: userId ?? null,
    });

    if (error || !data || data.length === 0) {
      console.error('[searchChunks] Error:', error);
      return [];
    }

    return data.map((item: any) => ({
      score: item.similarity,
      text: item.text,
      noteTitle: "",
      noteSubject: "",
      chunkId: item.id,
    }));
  } catch (error) {
    console.error('[searchChunks] Error:', error);
    return [];
  }
}
