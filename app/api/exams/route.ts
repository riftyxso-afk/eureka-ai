import { NextRequest, NextResponse } from "next/server";

import { addExam, deleteExam, listExams } from "@/lib/exams-store";
import { requireAuth } from "@/lib/assistant/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const userId = String(req.nextUrl.searchParams.get("userId") ?? "");
    if (!userId) {
      return NextResponse.json(
        { error: "userId diperlukan." },
        { status: 400 }
      );
    }
    // Wajib login; userId dari query harus cocok dengan token sesi.
    const auth = await requireAuth(req.headers.get("authorization"), userId);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const exams = await listExams(userId);
    return NextResponse.json({ exams });
  } catch (e) {
    const msg = "Gagal memuat ujian.";
    console.error("[api/exams] GET", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      action?: string;
      userId?: string;
      subject?: string;
      title?: string;
      date?: string;
      score?: number | null;
      examId?: string;
    } | null;
    const userId = String(body?.userId ?? "");
    if (!userId) {
      return NextResponse.json(
        { error: "userId diperlukan." },
        { status: 400 }
      );
    }
    // Wajib login; userId dari body harus cocok dengan token sesi.
    const auth = await requireAuth(req.headers.get("authorization"), userId);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (body?.action === "add") {
      const date = String(body?.date ?? "");
      if (!date) {
        return NextResponse.json(
          { error: "Tanggal ujian diperlukan." },
          { status: 400 }
        );
      }
      const exam = await addExam(userId, {
        subject: String(body?.subject ?? ""),
        title: String(body?.title ?? ""),
        date,
        score: body?.score,
      });
      return NextResponse.json({ ok: true, exam });
    }

    if (body?.action === "delete") {
      const removed = await deleteExam(userId, String(body?.examId ?? ""));
      if (!removed) {
        return NextResponse.json(
          { error: "Ujian tidak ditemukan." },
          { status: 404 }
        );
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "Aksi tidak dikenali." },
      { status: 400 }
    );
  } catch (e) {
    const msg = "Gagal memproses ujian.";
    console.error("[api/exams] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
