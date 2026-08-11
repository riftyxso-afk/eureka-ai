/**
 * Store MVP untuk Papan Tulis kolaboratif (Fase kolaborasi).
 * Persistensi file JSON lokal: data/whiteboards.json
 * Sinkronisasi realtime sementara via polling GET (MVP, tanpa websocket).
 */
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const BOARD_FILE = path.join(DATA_DIR, "whiteboards.json");

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

interface BoardStore {
  boards: Record<string, BoardData>;
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

async function readStore(): Promise<BoardStore> {
  try {
    const raw = await fs.readFile(BOARD_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<BoardStore>;
    return { boards: {}, ...parsed };
  } catch {
    return { boards: {} };
  }
}

async function writeStore(store: BoardStore) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(BOARD_FILE, JSON.stringify(store, null, 2), "utf-8");
}

function boardOf(store: BoardStore, noteId: string): BoardData {
  if (!store.boards[noteId]) {
    store.boards[noteId] = { strokes: [], clearedAt: 0 };
  }
  return store.boards[noteId];
}

export function getBoard(noteId: string): Promise<BoardData> {
  return withLock(async () => {
    const store = await readStore();
    return boardOf(store, noteId);
  });
}

export function addBoardStroke(
  noteId: string,
  stroke: Omit<BoardStroke, "id" | "createdAt">
): Promise<BoardStroke> {
  return withLock(async () => {
    const store = await readStore();
    const board = boardOf(store, noteId);
    const full: BoardStroke = {
      ...stroke,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    board.strokes.push(full);
    // Batasi jumlah goresan agar file tidak membengkak
    if (board.strokes.length > 3000) {
      board.strokes = board.strokes.slice(-2500);
    }
    await writeStore(store);
    return full;
  });
}

export function clearBoard(noteId: string): Promise<number> {
  return withLock(async () => {
    const store = await readStore();
    const board = boardOf(store, noteId);
    board.strokes = [];
    board.clearedAt = Date.now();
    await writeStore(store);
    return board.clearedAt;
  });
}
