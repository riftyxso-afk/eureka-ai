/**
 * POST /api/schedule/export — ekspor jadwal belajar sebagai PDF (schedule-export).
 *
 * Data jadwal mingguan tersimpan di localStorage user (schedule-store),
 * jadi klien mengirim payload jadwalnya ke sini; server me-render PDF
 * aesthetic via lib/scheduleExport dan membalas sebagai file unduhan.
 *
 * Body: { userName?, entries: ScheduleExportEntry[], tasks: ScheduleExportTask[] }
 */
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/assistant/auth";
import {
  buildSchedulePdfBuffer,
  type ScheduleExportEntry,
  type ScheduleExportTask,
} from "@/lib/scheduleExport";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req.headers.get("authorization"));
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    ensureRateLimitPrune();
    const rl = checkRateLimit(`sched-export:${auth.userId}`, 10, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak ekspor. Coba lagi nanti ya." },
        { status: 429 }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      userName?: unknown;
      entries?: unknown;
      tasks?: unknown;
    } | null;

    const entriesRaw = Array.isArray(body?.entries) ? body.entries : [];
    const entries: ScheduleExportEntry[] = entriesRaw
      .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
      .map((e) => ({
        day: String(e.day ?? ""),
        start: String(e.start ?? ""),
        end: String(e.end ?? ""),
        subject: String(e.subject ?? ""),
        room: e.room ? String(e.room).slice(0, 30) : undefined,
        color: typeof e.color === "string" ? e.color : undefined,
      }))
      .filter((e) => DAYS.includes(e.day) && e.subject && e.start && e.end)
      .slice(0, 80);

    const tasksRaw = Array.isArray(body?.tasks) ? body.tasks : [];
    const tasks: ScheduleExportTask[] = tasksRaw
      .filter((t): t is Record<string, unknown> => typeof t === "object" && t !== null)
      .map((t) => ({
        title: String(t.title ?? "").slice(0, 120),
        subject: t.subject ? String(t.subject).slice(0, 40) : undefined,
        dueDate: t.dueDate ? String(t.dueDate).slice(0, 10) : undefined,
        done: t.done === true,
      }))
      .filter((t) => t.title)
      .slice(0, 40);

    if (entries.length === 0 && tasks.length === 0) {
      return NextResponse.json(
        { error: "Jadwal kosong — tambahkan dulu di halaman Jadwal." },
        { status: 400 }
      );
    }

    const userName = String(body?.userName ?? "").trim().slice(0, 60);
    const pdf = await buildSchedulePdfBuffer({ userName, entries, tasks });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="jadwal-belajar-eureka.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[api/schedule/export]", e);
    return NextResponse.json(
      { error: "Gagal membuat PDF jadwal." },
      { status: 500 }
    );
  }
}
