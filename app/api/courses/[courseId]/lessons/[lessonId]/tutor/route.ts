import { NextRequest, NextResponse } from "next/server";
import { requirePro } from "@/lib/assistant/auth";
import { consumeCourseAiQuota, getLessonForUser } from "@/lib/courses/server";
import { answerLessonQuestion } from "@/lib/courses/generator";

export const runtime = "nodejs";
export const maxDuration = 60;

type Context = { params: Promise<{ courseId: string; lessonId: string }> };

export async function POST(req: NextRequest, { params }: Context) {
  const auth = await requirePro(req.headers.get("authorization"));
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const { courseId, lessonId } = await params;
    const body = await req.json().catch(() => null) as { question?: string; history?: { role?: string; content?: string }[] } | null;
    const found = await getLessonForUser(auth.userId, courseId, lessonId);
    if (!found || found.lesson.status === "pending" || found.lesson.status === "error") return NextResponse.json({ error: "Materi pelajaran belum tersedia." }, { status: 404 });
    if (typeof body?.question !== "string" || body.question.trim().length < 2) return NextResponse.json({ error: "Tuliskan pertanyaan tentang pelajaran ini." }, { status: 400 });
    if (!await consumeCourseAiQuota(auth.userId, "tutor", 30)) return NextResponse.json({ error: "Batas tutor hari ini tercapai. Kamu tetap bisa membaca materi dan mengulang latihan." }, { status: 429 });
    const history = (Array.isArray(body?.history) ? body.history : []).slice(-6).filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string").map((item) => ({ role: item.role as "user" | "assistant", content: String(item.content).slice(0, 1000) }));
    const answer = await answerLessonQuestion(found.course, found.lesson, String(body?.question ?? ""), history);
    return NextResponse.json({ answer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("[api/courses/tutor]", error);
    const safe = /Tuliskan pertanyaan|Tutor AI belum/i.test(message);
    return NextResponse.json({ error: safe ? message : "Momo belum dapat menjawab. Materi tetap dapat dibaca; coba tutor lagi sebentar." }, { status: safe ? 400 : 502 });
  }
}
