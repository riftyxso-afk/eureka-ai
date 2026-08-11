/**
 * Store MVP untuk Gambar Catatan (ilustrasi seperti buku).
 * Persistensi file JSON lokal: data/note-images.json
 */
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const IMAGES_FILE = path.join(DATA_DIR, "note-images.json");

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

let lock: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function readStore(): Promise<NoteImage[]> {
  try {
    const raw = await fs.readFile(IMAGES_FILE, "utf-8");
    const parsed = JSON.parse(raw) as NoteImage[];
    return Array.isArray(parsed) ? parsed.filter((i) => i && i.id) : [];
  } catch {
    return [];
  }
}

async function writeStore(store: NoteImage[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(IMAGES_FILE, JSON.stringify(store, null, 2), "utf-8");
}

/** Daftar gambar sebuah catatan (urut posisi). */
export function listImages(noteId: string): Promise<NoteImage[]> {
  return withLock(async () => {
    const store = await readStore();
    return store
      .filter((i) => i.noteId === noteId)
      .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
  });
}

/** Tambah satu gambar (upload user atau hasil scrape web). */
export function addImage(
  input: Omit<NoteImage, "id" | "position" | "createdAt">
): Promise<NoteImage> {
  return withLock(async () => {
    const store = await readStore();
    const noteImages = store.filter((i) => i.noteId === input.noteId);
    const position =
      noteImages.length > 0
        ? Math.max(...noteImages.map((i) => i.position)) + 1
        : 0;
    const entry: NoteImage = {
      ...input,
      id: randomUUID(),
      position,
      createdAt: new Date().toISOString(),
    };
    store.push(entry);
    await writeStore(store);
    return entry;
  });
}

/** Hapus gambar; kembalikan URL-nya agar file ikut dihapus oleh pemanggil. */
export function removeImage(
  noteId: string,
  imageId: string
): Promise<{ ok: boolean; url?: string }> {
  return withLock(async () => {
    const store = await readStore();
    const target = store.find((i) => i.id === imageId && i.noteId === noteId);
    if (!target) return { ok: false };
    const next = store.filter((i) => i.id !== imageId);
    await writeStore(next);
    return { ok: true, url: target.url };
  });
}
