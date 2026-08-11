/**
 * Penyimpanan mata pelajaran — Supabase.
 * Tabel: subjects. Total catatan per pelajaran dihitung live dari vector store.
 */
import { db } from "./supabase/admin";
import type { Subject } from "@/lib/subjects";

const DEFAULT_SUBJECTS: Subject[] = [
  { id: "s-mtk", name: "Matematika", emoji: "🧮", color: "#8B5CF6", progress: 75 },
  { id: "s-fis", name: "Fisika", emoji: "⚡", color: "#F59E0B", progress: 60 },
  { id: "s-kim", name: "Kimia", emoji: "🧪", color: "#10B981", progress: 45 },
  { id: "s-bio", name: "Biologi", emoji: "🧬", color: "#3B82F6", progress: 30 },
  { id: "s-eko", name: "Ekonomi", emoji: "📊", color: "#EF4444", progress: 20 },
  { id: "s-sej", name: "Sejarah", emoji: "📜", color: "#8B5CF6", progress: 10 },
];

function mapRow(row: any): Subject {
  return {
    id: row.id,
    name: row.name,
    emoji: row.icon ?? "📖",
    color: row.color ?? "#8B5CF6",
    progress: row.progress ?? 0,
  };
}

export async function getSubjects(): Promise<Subject[]> {
  try {
    const client = db();
    const { data, error } = await client
      .from("subjects")
      .select("*")
      .order("name");

    if (error) throw error;
    const rows = data ?? [];
    return rows.length > 0 ? rows.map(mapRow) : DEFAULT_SUBJECTS;
  } catch {
    return DEFAULT_SUBJECTS;
  }
}

export async function addSubject(input: {
  name: string;
  emoji?: string;
  color?: string;
}): Promise<Subject> {
  const client = db();
  const name = input.name.trim();
  if (!name) throw new Error("Nama mata pelajaran tidak boleh kosong.");

  const { data: existing } = await client
    .from("subjects")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (existing) throw new Error(`"${name}" sudah ada di daftar.`);

  const subject: Subject = {
    id: `s-${Date.now()}`,
    name,
    emoji: input.emoji?.trim() || "📖",
    color: input.color || "#8B5CF6",
    progress: 0,
  };

  const { data, error } = await client
    .from("subjects")
    .insert({
      id: subject.id,
      name,
      icon: subject.emoji,
      color: subject.color,
      progress: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return mapRow(data);
}

export async function deleteSubject(id: string): Promise<void> {
  const client = db();
  const { error } = await client.from("subjects").delete().eq("id", id);
  if (error) throw error;
}
