/**
 * Vector store MVP: file JSON lokal (data/vector-store.json).
 * Nanti bisa diganti dengan Supabase pgvector / Qdrant tanpa mengubah API-nya.
 */
import { promises as fs } from "fs";
import path from "path";

import type { Note } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "vector-store.json");

export interface StoredChunk {
  id: string;
  noteId: string;
  text: string;
  embedding: number[];
}

interface StoreShape {
  notes: Note[];
  chunks: StoredChunk[];
}

/**
 * Mutex sederhana: serialisasi semua operasi read-modify-write pada file.
 * Tanpa ini, tulis yang bersamaan (dua proses materi sekaligus) bisa saling
 * menimpa dan menghilangkan catatan/chunk.
 */
let lock: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function readStore(): Promise<StoreShape> {
  try {
    const raw = await fs.readFile(STORE_FILE, "utf-8");
    return JSON.parse(raw) as StoreShape;
  } catch {
    return { notes: [], chunks: [] };
  }
}

async function writeStore(store: StoreShape) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf-8");
}

export function saveNoteWithChunks(note: Note, chunks: StoredChunk[]): Promise<Note> {
  return withLock(async () => {
    const store = await readStore();
    store.notes.push(note);
    store.chunks.push(...chunks);
    await writeStore(store);
    return note;
  });
}

export function listNotes(): Promise<Note[]> {
  return withLock(async () => {
    const store = await readStore();
    return store.notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
}

export function updateNote(
  noteId: string,
  patch: Partial<Pick<Note, "title" | "summary">>
): Promise<Note | null> {
  return withLock(async () => {
    const store = await readStore();
    const note = store.notes.find((n) => n.id === noteId);
    if (!note) return null;
    Object.assign(note, patch);
    await writeStore(store);
    return note;
  });
}

export async function getNoteWithChunks(
  noteId: string
): Promise<{ note: Note; chunks: StoredChunk[] } | null> {
  const store = await readStore();
  const note = store.notes.find((n) => n.id === noteId);
  if (!note) return null;
  return { note, chunks: store.chunks.filter((c) => c.noteId === noteId) };
}

export function cosineSimilarity(a: number[], b: number[]): number {
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

export interface SearchResult {
  score: number;
  text: string;
  noteTitle: string;
  noteSubject: string;
  chunkId: string;
}

export async function searchChunks(
  queryEmbedding: number[],
  topK = 3,
  noteId?: string
): Promise<SearchResult[]> {
  const store = await readStore();
  const noteMap = new Map(store.notes.map((n) => [n.id, n]));

  const scored = store.chunks
    .filter((c) => !noteId || c.noteId === noteId)
    .map((c) => ({
      chunk: c,
      score: cosineSimilarity(queryEmbedding, c.embedding),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.map((r) => {
    const note = noteMap.get(r.chunk.noteId);
    return {
      score: r.score,
      text: r.chunk.text,
      noteTitle: note?.title ?? "Catatan",
      noteSubject: note?.subject ?? "",
      chunkId: r.chunk.id,
    };
  });
}
