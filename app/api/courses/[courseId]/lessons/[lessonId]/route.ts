import { NextRequest, NextResponse } from "next/server";
import { requirePro } from "@/lib/assistant/auth";
import { CourseOperationError, generateLessonForUser, getLessonForUser, submitAttempt } from "@/lib/courses/server";
import { toLearnerLesson } from "@/lib/courses/dto";

export const runtime = "nodejs";
export const maxDuration = 60;

type Context = { params: Promise<{ courseId: string; lessonId: string }> };

export async function GET(req: NextRequest, { params }: Context) {
  const auth = await requirePro(req.headers.get("authorization"));
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const { courseId, lessonId } = await params;
    const found = await getLessonForUser(auth.userId, courseId, lessonId);
    if (!found) return NextResponse.json({ error: "Pelajaran tidak ditemukan." }, { status: 404 });
    if (found.lesson.status === "pending" || found.lesson.status === "error") {
      return NextResponse.json({ error: "Pelajaran ini belum disusun.", pending: true }, { status: 409 });
    }
    return NextResponse.json({ lesson: toLearnerLesson(found.lesson), course: { id: found.course.id, title: found.course.title, sourceKind: found.course.sourceKind } });
  } catch (error) {
    console.error("[api/courses/lesson] GET", error);
    return NextResponse.json({ error: "Pelajaran belum dapat dimuat." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Context) {
  const auth = await requirePro(req.headers.get("authorization"));
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const { courseId, lessonId } = await params;
    const body = await req.json().catch(() => null) as { action?: string; answers?: Record<string, number>; idempotencyKey?: string } | null;
    if (body?.action === "generate") {
      const found = await getLessonForUser(auth.userId, courseId, lessonId);
      if (!found) return NextResponse.json({ error: "Pelajaran tidak ditemukan." }, { status: 404 });
      if (found.course.sourceKind !== "generated") return NextResponse.json({ error: "Pelajaran terkurasi sudah tersedia." }, { status: 400 });
      const generated = await generateLessonForUser(auth.userId, courseId, lessonId);
      return NextResponse.json({ lesson: toLearnerLesson(generated.lesson), course: { id: generated.course.id, title: generated.course.title, sourceKind: generated.course.sourceKind } });
    }
    if (body?.action === "attempt") {
      const result = await submitAttempt(auth.userId, courseId, lessonId, body.answers ?? {}, String(body.idempotencyKey ?? ""));
      return NextResponse.json({ attempt: result });
    }
    return NextResponse.json({ error: "Aksi pelajaran tidak dikenali." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (error instanceof CourseOperationError) return NextResponse.json({ error: message, pending: error.status === 409 }, { status: error.status });
    console.error("[api/courses/lesson] POST", error);
    const safe = /Jawab semua|Kunci percobaan|Ikuti kursus|Pelajaran belum|AI belum|struktur|Batas AI/i.test(message);
    return NextResponse.json({ error: safe ? message : "Pelajaran belum dapat diproses. Coba lagi." }, { status: safe ? 400 : 500 });
  }
}
