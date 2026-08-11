/**
 * Store MVP untuk Highlight (stabilo) catatan.
 * Persistensi file JSON lokal: data/highlights.json
 */
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const HIGHLIGHTS_FILE = path.join(DATA_DIR, "highlights.json");

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

let lock: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function readStore(): Promise<HighlightEntry[]> {
  try {
    const raw = await fs.readFile(HIGHLIGHTS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as HighlightEntry[];
    return Array.isArray(parsed) ? parsed.filter((h) => h && h.id) : [];
  } catch {
    return [];
  }
}

async function writeStore(store: HighlightEntry[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(HIGHLIGHTS_FILE, JSON.stringify(store, null, 2), "utf-8");
}

/** Daftar highlight sebuah catatan (opsional difilter per bab). */
export function listHighlights(
  noteId: string,
  chapterId?: number
): Promise<HighlightEntry[]> {
  return withLock(async () => {
    const store = await readStore();
    return store
      .filter((h) => h.noteId === noteId && (chapterId == null || h.chapterId === chapterId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
}

/** Tambah highlight (dedupe bila teks+chapter+warna sudah ada). */
export function addHighlight(
  input: Omit<HighlightEntry, "id" | "createdAt">
): Promise<HighlightEntry | null> {
  return withLock(async () => {
    const store = await readStore();
    const key = input.text.trim().toLowerCase();
    const exists = store.some(
      (h) =>
        h.noteId === input.noteId &&
        h.chapterId === input.chapterId &&
        h.color === input.color &&
        h.text.trim().toLowerCase() === key
    );
    if (exists) return null;
    const entry: HighlightEntry = {
      ...input,
      text: input.text.trim().slice(0, 500),
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    store.push(entry);
    await writeStore(store);
    return entry;
  });
}

/** Hapus satu highlight. */
export function removeHighlight(
  noteId: string,
  highlightId: string
): Promise<boolean> {
  return withLock(async () => {
    const store = await readStore();
    const next = store.filter(
      (h) => !(h.id === highlightId && h.noteId === noteId)
    );
    if (next.length === store.length) return false;
    await writeStore(next);
    return true;
  });
}

/** Hapus semua highlight otomatis dari AI (untuk regenerasi stabilo). */
export function removeAiHighlights(noteId: string): Promise<number> {
  return withLock(async () => {
    const store = await readStore();
    const before = store.length;
    const next = store.filter(
      (h) => !(h.noteId === noteId && h.userId === "ai")
    );
    if (next.length !== before) {
      await writeStore(next);
    }
    return before - next.length;
  });
}
