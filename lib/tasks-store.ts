/**
 * Store fitur Tugas (task-reminders) — Supabase.
 * Tabel: tasks (lihat supabase_patch_020_tasks_reminders.sql)
 *
 * Tugas punya tenggat + pengingat berbasis jam-quotient (remind_hours_before):
 * cron mengirim notifikasi saat waktu-pengingat tiba (sekali per tugas,
 * dicek via reminder_sent_at).
 */
import { db } from "./supabase/admin";

export type TaskStatus = "belum" | "progres" | "selesai";
export type TaskPriority = "rendah" | "sedang" | "tinggi";
/** Pilihan jarak pengingat (jam sebelum tenggat). */
export const REMIND_CHOICES = [1, 6, 24, 72] as const;
export type RemindHours = (typeof REMIND_CHOICES)[number];

export interface TaskEntry {
  id: string;
  title: string;
  subject: string;
  /** Tanggal tenggat (YYYY-MM-DD). */
  dueDate: string;
  /** Jam tenggat 0–23; null = 23:59. */
  dueHour: number | null;
  priority: TaskPriority;
  status: TaskStatus;
  remindHoursBefore: RemindHours;
  /** ISO timestamp pengingat terakhir terkirim (null = belum). */
  reminderSentAt: string | null;
  createdAt: string;
}

function mapRow(row: any): TaskEntry {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject ?? "Umum",
    dueDate: row.due_date,
    dueHour: row.due_hour ?? null,
    priority: row.prioritas ?? "sedang",
    status: row.status ?? "belum",
    remindHoursBefore: row.remind_hours_before ?? 24,
    reminderSentAt: row.reminder_sent_at ?? null,
    createdAt: row.created_at,
  };
}

export async function listTasks(userId: string): Promise<TaskEntry[]> {
  const client = db();
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .order("due_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function addTask(
  userId: string,
  input: {
    title: string;
    subject?: string;
    dueDate: string;
    dueHour?: number | null;
    priority?: TaskPriority;
    remindHoursBefore?: RemindHours;
  }
): Promise<TaskEntry> {
  const title = input.title.trim().slice(0, 200);
  if (!title) throw new Error("Judul tugas tidak boleh kosong.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
    throw new Error("Tanggal tenggat tidak valid.");
  }
  const client = db();
  const { data: row, error } = await client
    .from("tasks")
    .insert({
      user_id: userId,
      title,
      subject: input.subject?.trim().slice(0, 80) || "Umum",
      due_date: input.dueDate,
      due_hour:
        input.dueHour != null && input.dueHour >= 0 && input.dueHour <= 23
          ? input.dueHour
          : null,
      prioritas: input.priority ?? "sedang",
      status: "belum",
      remind_hours_before: input.remindHoursBefore ?? 24,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRow(row);
}

export async function updateTask(
  userId: string,
  taskId: string,
  updates: Partial<{
    title: string;
    subject: string;
    due_date: string;
    due_hour: number | null;
    prioritas: TaskPriority;
    status: TaskStatus;
    remind_hours_before: RemindHours;
  }>
): Promise<TaskEntry | null> {
  const client = db();
  const { data, error } = await client
    .from("tasks")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw error;
  return data ? mapRow(data) : null;
}

export async function deleteTask(userId: string, taskId: string): Promise<boolean> {
  const client = db();
  const { error } = await client
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", userId);
  if (error) throw error;
  return true;
}

/**
 * Waktu tenggat absolut (ISO) dari dueDate + dueHour.
 * Server berjalan di zona WIB (Asia/Jakarta) — VPS & cron memakai jam lokal.
 */
export function taskDueInstant(t: TaskEntry): Date {
  const hour = t.dueHour ?? 23;
  return new Date(`${t.dueDate}T${String(hour).padStart(2, "0")}:59:59+07:00`);
}
