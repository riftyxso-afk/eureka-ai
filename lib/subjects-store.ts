/**
 * Penyimpanan mata pelajaran (data/subjects.json).
 * Total catatan per pelajaran dihitung live dari vector store.
 */
import { promises as fs } from "fs";
import path from "path";

import type { Subject } from "@/lib/subjects";

const DATA_DIR = path.join(process.cwd(), "data");
const SUBJECTS_FILE = path.join(DATA_DIR, "subjects.json");

const DEFAULT_SUBJECTS: Subject[] = [
  { id: "s-mtk", name: "Matematika", emoji: "🧮", color: "#8B5CF6", progress: 75 },
  { id: "s-fis", name: "Fisika", emoji: "⚡", color: "#F59E0B", progress: 60 },
  { id: "s-kim", name: "Kimia", emoji: "🧪", color: "#10B981", progress: 45 },
  { id: "s-bio", name: "Biologi", emoji: "🧬", color: "#3B82F6", progress: 30 },
  { id: "s-eko", name: "Ekonomi", emoji: "📊", color: "#EF4444", progress: 20 },
  { id: "s-sej", name: "Sejarah", emoji: "📜", color: "#8B5CF6", progress: 10 },
];

async function readSubjects(): Promise<Subject[]> {
  try {
    const raw = await fs.readFile(SUBJECTS_FILE, "utf-8");
    return JSON.parse(raw) as Subject[];
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(SUBJECTS_FILE, JSON.stringify(DEFAULT_SUBJECTS, null, 2), "utf-8");
    return DEFAULT_SUBJECTS;
  }
}

async function writeSubjects(subjects: Subject[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SUBJECTS_FILE, JSON.stringify(subjects, null, 2), "utf-8");
}

export async function getSubjects(): Promise<Subject[]> {
  return readSubjects();
}

export async function addSubject(input: {
  name: string;
  emoji?: string;
  color?: string;
}): Promise<Subject> {
  const subjects = await readSubjects();
  const name = input.name.trim();
  if (!name) throw new Error("Nama mata pelajaran tidak boleh kosong.");

  const existing = subjects.find((s) => s.name.toLowerCase() === name.toLowerCase());
  if (existing) throw new Error(`"${name}" sudah ada di daftar.`);

  const subject: Subject = {
    id: `s-${Date.now()}`,
    name,
    emoji: input.emoji?.trim() || "📖",
    color: input.color || "#8B5CF6",
    progress: 0,
  };
  subjects.push(subject);
  await writeSubjects(subjects);
  return subject;
}

export async function deleteSubject(id: string): Promise<void> {
  const subjects = await readSubjects();
  await writeSubjects(subjects.filter((s) => s.id !== id));
}
