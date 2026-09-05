/**
 * GET /api/cron/reminders — pengingat tugas & ujian (task-reminders).
 *
 * Dipanggil otomatis:
 * - Vercel Cron (vercel.json → 1×/jam)
 * - VPS: pm2 cron atau crontab (1×/jam)
 *
 * Logika:
 * - TASK: bila (tenggat − now) ≤ remind_hours_before dan reminder_sent_at
 *   masih null → kirim notifikasi in-app + web push, tandai terkirim.
 * - EXAM: ujian "upcoming" dengan tanggal = besok → kirim pengingat H-1
 *   (dedup via notifikasi exam_reminder dengan link yang sama hari ini).
 *
 * Proteksi: header Authorization harus sama dengan CRON_SECRET (bila diisi).
 */
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/supabase/admin";
import { listTasks, taskDueInstant, type TaskEntry } from "@/lib/tasks-store";
import { pushNotification } from "@/lib/notifications-store";
import { sendPushToUser } from "@/lib/push-send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ReminderResult {
  tasks: number;
  exams: number;
  errors: string[];
}

function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return true; // tidak diset → endpoint terbuka (dev/awal)
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

/** Kirim notifikasi in-app + web push untuk satu user. */
async function notifyUser(
  userId: string,
  type: "task_reminder" | "exam_reminder",
  title: string,
  message: string,
  link: string
): Promise<void> {
  try {
    await pushNotification(userId, { type, title, message, link });
  } catch (e) {
    console.warn("[cron/reminders] pushNotification gagal:", e);
  }
  try {
    await sendPushToUser(userId, { title, body: message, url: link, tag: `${type}-${link}` });
  } catch (e) {
    // web push opsional — lonceng in-app tetap terkirim
  }
}

/** Proses pengingat tugas: kirim bila mendekati tenggat & belum terkirim. */
async function processTaskReminders(): Promise<{ sent: number; errors: string[] }> {
  const client = db();
  const now = Date.now();
  const errors: string[] = [];
  let sent = 0;

  // Tugas yang belum selesai & belum dikirim pengingatnya.
  const { data: rows, error } = await client
    .from("tasks")
    .select("id,user_id,subject,title,due_date,due_hour,prioritas,status,remind_hours_before,reminder_sent_at,created_at")
    .neq("status", "selesai")
    .is("reminder_sent_at", null)
    .limit(500);
  if (error) {
    return { sent: 0, errors: [`query tasks: ${error.message}`] };
  }

  for (const row of rows ?? []) {
    const task: TaskEntry = {
      id: row.id,
      title: row.title,
      subject: row.subject ?? "Umum",
      dueDate: row.due_date,
      dueHour: row.due_hour ?? null,
      priority: row.prioritas ?? "sedang",
      status: row.status ?? "belum",
      remindHoursBefore: row.remind_hours_before ?? 24,
      reminderSentAt: row.reminder_sent_at ?? null,
      createdAt: row.created_at ?? new Date().toISOString(),
    };
    const due = taskDueInstant(task).getTime();
    const remindAt = due - task.remindHoursBefore * 60 * 60 * 1000;
    // Kirim bila sekarang sudah masuk jendela pengingat, dan belum lewat
    // tenggat terlalu jauh (maks 48 jam setelah tenggat — mencegah spam tugas lama).
    if (now < remindAt || now > due + 48 * 60 * 60 * 1000) continue;

    try {
      const jamLabel = task.remindHoursBefore >= 24
        ? `${Math.round(task.remindHoursBefore / 24)} hari`
        : `${task.remindHoursBefore} jam`;
      await notifyUser(
        task.id && (row.user_id as string),
        "task_reminder",
        "Pengingat tugas ⏰",
        `Tugas "${task.title}" (${task.subject}) tenggat ${jamLabel} lagi — jangan sampai kelewat!`,
        "/dashboard/tugas"
      );
      const { error: upErr } = await client
        .from("tasks")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", task.id);
      if (upErr) throw upErr;
      sent++;
    } catch (e) {
      errors.push(`task ${task.id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return { sent, errors };
}

/** Proses pengingat ujian H-1 (dedup: 1 notifikasi per ujian per hari). */
async function processExamReminders(): Promise<{ sent: number; errors: string[] }> {
  const client = db();
  const errors: string[] = [];
  let sent = 0;

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const { data: rows, error } = await client
    .from("exams")
    .select("id,user_id,title,subject,date")
    .eq("status", "upcoming")
    .eq("date", tomorrow)
    .limit(200);
  if (error) {
    return { sent: 0, errors: [`query exams: ${error.message}`] };
  }

  for (const row of rows ?? []) {
    try {
      // Dedup: cek notifikasi exam_reminder untuk ujian ini hari ini.
      const since = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
      const { data: existing } = await client
        .from("notifications")
        .select("id")
        .eq("user_id", row.user_id)
        .eq("type", "exam_reminder")
        .like("link", `%exam%${row.id}%`)
        .gte("created_at", since)
        .limit(1);
      if (existing && existing.length > 0) continue;

      await notifyUser(
        row.user_id as string,
        "exam_reminder",
        "Besok ujian! 📚",
        `Ujian "${row.title}" (${row.subject}) besok — siapkan catatanmu di Eureka!`,
        `/dashboard?subject=${encodeURIComponent(row.subject ?? "")}`
      );
      sent++;
    } catch (e) {
      errors.push(`exam ${row.id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return { sent, errors };
}

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const result: ReminderResult = { tasks: 0, exams: 0, errors: [] };

  try {
    const t = await processTaskReminders();
    result.tasks = t.sent;
    result.errors.push(...t.errors);
  } catch (e) {
    result.errors.push(`tasks: ${e instanceof Error ? e.message : e}`);
  }
  try {
    const x = await processExamReminders();
    result.exams = x.sent;
    result.errors.push(...x.errors);
  } catch (e) {
    result.errors.push(`exams: ${e instanceof Error ? e.message : e}`);
  }

  return NextResponse.json({
    ok: result.errors.length === 0,
    ...result,
    at: new Date().toISOString(),
  });
}
