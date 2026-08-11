/**
 * Store fitur Ujian (jadwal + hasil) — Supabase.
 * Tabel: exams
 */
import { db } from "./supabase/admin";

export interface ExamEntry {
  id: string;
  subject: string;
  title: string;
  date: string;
  status: "upcoming" | "completed";
  score: number | null;
  createdAt: string;
}

function mapRow(row: any): ExamEntry {
  return {
    id: row.id,
    subject: row.subject,
    title: row.title,
    date: row.date,
    status: row.status,
    score: row.score,
    createdAt: row.created_at,
  };
}

export async function listExams(userId: string): Promise<ExamEntry[]> {
  const client = db();
  const { data, error } = await client
    .from("exams")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function addExam(
  userId: string,
  data: {
    subject: string;
    title: string;
    date: string;
    score?: number | null;
  }
): Promise<ExamEntry> {
  const client = db();
  const status: ExamEntry["status"] =
    Number.isFinite(data.score) && data.score !== null
      ? "completed"
      : "upcoming";
  const title = data.title.trim().slice(0, 120);
  if (!title) throw new Error("Nama ujian tidak boleh kosong.");

  const { data: row, error } = await client
    .from("exams")
    .insert({
      user_id: userId,
      subject: data.subject.trim().slice(0, 80) || "Umum",
      title,
      date: data.date,
      status,
      score: status === "completed" ? data.score! : null,
    })
    .select()
    .single();

  if (error) throw error;
  return mapRow(row);
}

export async function deleteExam(
  userId: string,
  examId: string
): Promise<boolean> {
  const client = db();
  const { error } = await client
    .from("exams")
    .delete()
    .eq("id", examId)
    .eq("user_id", userId);

  if (error) throw error;
  return true;
}
