/**
 * Store MVP untuk fitur Ujian (jadwal + hasil).
 * Persistensi file JSON lokal: data/exams.json
 */
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const EXAMS_FILE = path.join(DATA_DIR, "exams.json");

export interface ExamEntry {
  id: string;
  subject: string;
  title: string;
  date: string;
  status: "upcoming" | "completed";
  score: number | null;
  createdAt: string;
}

interface ExamsStore {
  users: Record<string, ExamEntry[]>;
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

async function readStore(): Promise<ExamsStore> {
  try {
    const raw = await fs.readFile(EXAMS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ExamsStore>;
    return { users: {}, ...parsed };
  } catch {
    return { users: {} };
  }
}

async function writeStore(store: ExamsStore) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(EXAMS_FILE, JSON.stringify(store, null, 2), "utf-8");
}

export function listExams(userId: string): Promise<ExamEntry[]> {
  return withLock(async () => {
    const store = await readStore();
    const exams = store.users[userId] ?? [];
    return [...exams].sort((a, b) => a.date.localeCompare(b.date));
  });
}

export function addExam(
  userId: string,
  data: {
    subject: string;
    title: string;
    date: string;
    score?: number | null;
  }
): Promise<ExamEntry> {
  return withLock(async () => {
    const store = await readStore();
    const exams = store.users[userId] ?? [];
    const status: ExamEntry["status"] =
      Number.isFinite(data.score) && data.score !== null
        ? "completed"
        : "upcoming";
    const entry: ExamEntry = {
      id: randomUUID(),
      subject: data.subject.trim().slice(0, 80) || "Umum",
      title: data.title.trim().slice(0, 120),
      date: data.date,
      status,
      score: status === "completed" ? data.score! : null,
      createdAt: new Date().toISOString(),
    };
    if (!entry.title) throw new Error("Nama ujian tidak boleh kosong.");
    exams.push(entry);
    store.users[userId] = exams;
    await writeStore(store);
    return entry;
  });
}

export function deleteExam(userId: string, examId: string): Promise<boolean> {
  return withLock(async () => {
    const store = await readStore();
    const exams = store.users[userId] ?? [];
    const before = exams.length;
    store.users[userId] = exams.filter((e) => e.id !== examId);
    if (store.users[userId].length === before) return false;
    await writeStore(store);
    return true;
  });
}
