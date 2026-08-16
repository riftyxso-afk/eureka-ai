/**
 * Penyimpanan mata pelajaran — Supabase.
 * Tabel: subjects. Total catatan per pelajaran dihitung live dari vector store.
 *
 * MATA PELAJARAN PER-USER: semua fungsi menerima userId dan memfilter ke
 * data milik user tersebut. Akun baru mulai dengan daftar kosong (tanpa
 * seed global) — lihat supabase_patch_015_user_subjects.sql.
 */
import { db } from "./supabase/admin";
import type { Subject } from "@/lib/subjects";

function mapRow(row: any): Subject {
  return {
    id: row.id,
    name: row.name,
    emoji: row.icon ?? "📖",
    color: row.color ?? "#8B5CF6",
    progress: row.progress ?? 0,
  };
}

export async function getSubjects(userId: string): Promise<Subject[]> {
  if (!userId) return [];
  const client = db();
  const { data, error } = await client
    .from("subjects")
    .select("*")
    .eq("user_id", userId)
    .order("name");

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function addSubject(
  input: { name: string; emoji?: string; color?: string },
  userId: string
): Promise<Subject> {
  if (!userId) throw new Error("Autentikasi diperlukan.");
  const client = db();
  const name = input.name.trim();
  if (!name) throw new Error("Nama mata pelajaran tidak boleh kosong.");

  const { data: existing } = await client
    .from("subjects")
    .select("id")
    .eq("user_id", userId)
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
      user_id: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return mapRow(data);
}

export async function deleteSubject(id: string, userId: string): Promise<void> {
  if (!userId) throw new Error("Autentikasi diperlukan.");
  const client = db();
  // Hanya hapus bila subjek benar-benar milik user ini.
  const { error } = await client
    .from("subjects")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}
