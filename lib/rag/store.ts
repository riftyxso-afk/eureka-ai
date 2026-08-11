/**
 * Supabase Integration for RAG (Retrieval Augmented Generation)
 * Complete migration from local file system to Supabase database
 */

import { supabase } from '../supabase/client';
import type { Note, Chunk, SearchResult } from '../types';
import { cosineSimilarity } from './chunk';

export interface StoredChunk {
  id: string;
  noteId: string;
  text: string;
  embedding: number[];
}

interface SupabaseNote extends Omit<Note, 'chunks'> {
  chunks?: any[];
}

/**
 * Save a note with its chunks to Supabase
 */
export async function saveNoteWithChunks(
  note: Note & { user_id: string },
  chunks: string[],
  chapterId: number = 0
): Promise<Note> {
  try {
    // First, insert the note
    const { data: savedNote, error: noteError } = await supabase
      .from('notes')
      .insert({
        id: note.id,
        title: note.title,
        summary: note.summary,
        subject: note.subject,
        user_id: note.user_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (noteError) throw noteError;

    // Then, insert all chunks with embedding null (will be updated later by background job)
    const chunkRecords = chunks.map((text, index) => ({
      note_id: note.id,
      chapter_id: chapterId,
      text: text.trim(),
      embedding: null,
    }));

    const { error: chunksError } = await supabase
      .from('chunks')
      .insert(chunkRecords);

    if (chunksError) throw chunksError;

    return savedNote as Note;
  } catch (error) {
    console.error('[saveNoteWithChunks] Error:', error);
    throw error;
  }
}

/**
 * List all notes for a user
 */
export async function listNotes(): Promise<Note[]> {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    
    // Filter out private fields
    return (data ?? []).map(n => ({
      id: n.id,
      title: n.title,
      summary: n.summary,
      subject: n.subject,
      createdAt: n.created_at,
      updatedAt: n.updated_at,
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
  patch: Partial<Pick<Note, "title" | "summary">>
): Promise<Note | null> {
  try {
    const { data, error } = await supabase
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
    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .single();

    if (noteError || !note) return null;

    // Get chunks
    const { data: chunks, error: chunksError } = await supabase
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
        createdAt: note.created_at,
        updatedAt: note.updated_at,
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
    const { error } = await supabase
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
 * Search chunks using vector similarity
 */
export async function searchChunks(
  queryEmbedding: number[],
  topK: number = 3,
  noteId?: string
): Promise<SearchResult[]> {
  try {
    // Use Supabase RPC function match_chunks
    const { data, error } = await supabase.rpc('match_chunks', {
      query_embedding: queryEmbedding as number[],
      note_id: noteId,
      similarity_threshold: 0.78,
      top_k: topK,
    });

    if (error) throw error;

    if (!data || data.length === 0) return [];

    return data.map(item => ({
      score: item.similarity,
      text: item.text,
      noteTitle: "", // Will be fetched separately if needed
      noteSubject: "",
      chunkId: item.id,
    }));
  } catch (error) {
    console.error('[searchChunks] Error:', error);
    // Fallback to client-side similarity if RPC fails
    return [];
  }
}

/**
 * Update chunk embeddings (usually done by background job)
 */
export async function updateChunksEmbeddings(noteId: string, embeddings: number[][]): Promise<void> {
  try {
    const { data: chunks } = await supabase
      .from('chunks')
      .select('id')
      .eq('note_id', noteId)
      .order('id');

    if (!chunks || chunks.length !== embeddings.length) {
      throw new Error('Number of embeddings does not match number of chunks');
    }

    // Update each chunk's embedding
    for (const [index, embedding] of embeddings.entries()) {
      await supabase
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
