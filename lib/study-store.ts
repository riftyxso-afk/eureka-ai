/**
 * Store MVP untuk kuis & flashcards yang dibuat otomatis (mode Standar/Lengkap)
 * atau on-demand lewat modal. Persistensi: data/note-study.json
 */
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const STUDY_FILE = path.join(DATA_DIR, "note-study.json");

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface Flashcard {
  id: number;
  front: string;
  back: string;
}

interface StudyShape {
  quizzes: Record<string, QuizQuestion[]>;
  flashcards: Record<string, Flashcard[]>;
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

async function readStore(): Promise<StudyShape> {
  try {
    const raw = await fs.readFile(STUDY_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<StudyShape>;
    return {
      quizzes: parsed.quizzes ?? {},
      flashcards: parsed.flashcards ?? {},
    };
  } catch {
    return { quizzes: {}, flashcards: {} };
  }
}

async function writeStore(store: StudyShape) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STUDY_FILE, JSON.stringify(store, null, 2), "utf-8");
}

export function getSavedQuiz(noteId: string): Promise<QuizQuestion[]> {
  return withLock(async () => {
    const store = await readStore();
    return store.quizzes[noteId] ?? [];
  });
}

export function saveQuiz(noteId: string, questions: QuizQuestion[]) {
  return withLock(async () => {
    const store = await readStore();
    store.quizzes[noteId] = questions;
    await writeStore(store);
  });
}

export function getSavedFlashcards(noteId: string): Promise<Flashcard[]> {
  return withLock(async () => {
    const store = await readStore();
    return store.flashcards[noteId] ?? [];
  });
}

export function saveFlashcards(noteId: string, cards: Flashcard[]) {
  return withLock(async () => {
    const store = await readStore();
    store.flashcards[noteId] = cards;
    await writeStore(store);
  });
}
