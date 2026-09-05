/**
 * /api/tasks — CRUD tugas (task-reminders).
 *
 * GET    ?userId=…                     → daftar tugas user
 * POST   { action:"add"|"update"|"delete"|"toggle", … }
 *
 * Toggle: siklus status belum → progres → selesai → belum.
 */
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/assistant/auth";
import {
  addTask,
  deleteTask,
  listTasks,
  updateTask,
  REMIND_CHOICES,
  type RemindHours,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks-store";
import { ensureRateLimitPrune, checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUS: TaskStatus[] = ["belum", "progres", "selesai"];
const VALID_PRIORITY: TaskPriority[] = ["rendah", "sedang", "tinggi"];

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req.headers.get("authorization"));
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const tasks = await listTasks(auth.userId);
    return NextResponse.json({ tasks });
  } catch (e) {
    console.error("[api/tasks] GET", e);
    return NextResponse.json({ error: "Gagal memuat tugas." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req.headers.get("authorization"));
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    ensureRateLimitPrune();
    const rl = checkRateLimit(`tasks:${auth.userId}`, 60, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak permintaan. Tunggu sebentar ya." },
        { status: 429 }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      action?: string;
      title?: unknown;
      subject?: unknown;
      dueDate?: unknown;
      dueHour?: unknown;
      priority?: unknown;
      remindHoursBefore?: unknown;
      taskId?: unknown;
      status?: unknown;
    } | null;

    const action = String(body?.action ?? "");

    if (action === "add") {
      const title = String(body?.title ?? "").trim();
      const dueDate = String(body?.dueDate ?? "").trim();
      if (!title || !dueDate) {
        return NextResponse.json(
          { error: "Judul dan tanggal tenggat wajib diisi." },
          { status: 400 }
        );
      }
      const remindRaw = Number(body?.remindHoursBefore ?? 24);
      const remind = (REMIND_CHOICES as readonly number[]).includes(remindRaw)
        ? (remindRaw as RemindHours)
        : 24;
      const priorityRaw = String(body?.priority ?? "sedang");
      const priority = (VALID_PRIORITY as string[]).includes(priorityRaw)
        ? (priorityRaw as TaskPriority)
        : "sedang";
      const dueHourRaw = body?.dueHour;
      const dueHour =
        dueHourRaw == null || dueHourRaw === ""
          ? null
          : Math.min(23, Math.max(0, Number(dueHourRaw) || 0));
      const task = await addTask(auth.userId, {
        title,
        subject: String(body?.subject ?? "").trim(),
        dueDate,
        dueHour,
        priority,
        remindHoursBefore: remind,
      });
      return NextResponse.json({ task });
    }

    if (action === "update" || action === "toggle") {
      const taskId = String(body?.taskId ?? "").trim();
      if (!taskId) {
        return NextResponse.json({ error: "taskId diperlukan." }, { status: 400 });
      }
      let updates: Parameters<typeof updateTask>[2] = {};
      if (action === "toggle") {
        // Siklus status: belum → progres → selesai → belum.
        const tasks = await listTasks(auth.userId);
        const current = tasks.find((t) => t.id === taskId);
        if (!current) {
          return NextResponse.json({ error: "Tugas tidak ditemukan." }, { status: 404 });
        }
        const next: TaskStatus =
          current.status === "belum" ? "progres" : current.status === "progres" ? "selesai" : "belum";
        updates = { status: next };
      } else {
        const status = String(body?.status ?? "");
        if ((VALID_STATUS as string[]).includes(status)) {
          updates.status = status as TaskStatus;
        }
        const priority = String(body?.priority ?? "");
        if ((VALID_PRIORITY as string[]).includes(priority)) {
          updates.prioritas = priority as TaskPriority;
        }
        const title = String(body?.title ?? "").trim();
        if (title) updates.title = title.slice(0, 200);
        const dueDate = String(body?.dueDate ?? "").trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) updates.due_date = dueDate;
        if (body?.dueHour !== undefined) {
          const h = Number(body.dueHour);
          updates.due_hour = Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : null;
        }
        const remind = Number(body?.remindHoursBefore ?? NaN);
        if ((REMIND_CHOICES as readonly number[]).includes(remind)) {
          updates.remind_hours_before = remind as RemindHours;
        }
      }
      const task = await updateTask(auth.userId, taskId, updates);
      if (!task) {
        return NextResponse.json({ error: "Tugas tidak ditemukan." }, { status: 404 });
      }
      return NextResponse.json({ task });
    }

    if (action === "delete") {
      const taskId = String(body?.taskId ?? "").trim();
      if (!taskId) {
        return NextResponse.json({ error: "taskId diperlukan." }, { status: 400 });
      }
      await deleteTask(auth.userId, taskId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Terjadi kesalahan.";
    console.error("[api/tasks] POST", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
