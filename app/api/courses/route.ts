import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { requireAuth } from "@/lib/assistant/auth";
import { consumeCourseAiQuota, enrollInCourse, generateLessonForUser, getCourseCatalog, getCourseOverview, savePersonalCourse } from "@/lib/courses/server";
import { generateCourseSyllabus, normalizePersonalDraft, validatePersonalCourseInput } from "@/lib/courses/generator";
import { toSyllabusOverview, toSyllabusPreview } from "@/lib/courses/dto";
import { courseLessons } from "@/lib/courses/types";
import { readCourseSources } from "@/lib/courses/readSources";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req.headers.get("authorization"));
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    return NextResponse.json(await getCourseCatalog(auth.userId));
  } catch (error) {
    console.error("[api/courses] GET", error);
    return NextResponse.json({ error: "Katalog kursus belum dapat dimuat." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req.headers.get("authorization"));
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    if (Number(req.headers.get("content-length")) > 21_000_000) {
      return NextResponse.json({ error: "Ukuran total sumber kursus terlalu besar." }, { status: 413 });
    }
    const form = req.headers.get("content-type")?.startsWith("multipart/form-data") ? await req.formData() : null;
    const body = (form ? { action: "preview", input: JSON.parse(String(form.get("input") ?? "null")) } : await req.json().catch(() => null)) as { action?: string; input?: unknown; course?: unknown; idempotencyKey?: string } | null;
    if (body?.action === "preview") {
      const input = validatePersonalCourseInput(body.input);
      if (!await consumeCourseAiQuota(auth.userId, "generate", 12)) {
        return NextResponse.json({ error: "Batas penyusunan kursus hari ini tercapai. Materi gratis tetap dapat dibuka; coba lagi besok." }, { status: 429 });
      }
      const result = await generateCourseSyllabus(input, form ? await readCourseSources(form) : []);
      return NextResponse.json({ course: toSyllabusPreview(result.course), mode: result.mode });
    }
    if (body?.action === "create") {
      const key = String(body.idempotencyKey ?? "");
      if (!/^[a-zA-Z0-9:_-]{8,100}$/.test(key)) return NextResponse.json({ error: "Kunci pembuatan kursus tidak valid. Buka ulang formulir." }, { status: 400 });
      const courseId = `custom-${createHash("sha256").update(`${auth.userId}:${key}`).digest("hex").slice(0, 32)}`;
      const existing = await getCourseOverview(auth.userId, courseId);
      const course = existing?.course ?? normalizePersonalDraft(body.course, courseId);
      if (!existing) {
        if (!await consumeCourseAiQuota(auth.userId, "create", 12)) return NextResponse.json({ error: "Batas pembuatan kursus hari ini tercapai. Kursus yang sudah ada tetap dapat dipelajari." }, { status: 429 });
        await savePersonalCourse(auth.userId, course);
      }
      let warning = "";
      const first = courseLessons(course)[0];
      if (first) {
        try {
          await generateLessonForUser(auth.userId, course.id, first.id);
        } catch (error) {
          console.error("[api/courses] first lesson", error);
          warning = "Silabus tetap tersimpan. Buka pelajaran pertama untuk mencoba menyusunnya kembali.";
        }
      } else {
        warning = "Silabus tersimpan. Batas AI hari ini tercapai; buka pelajaran untuk mencoba lagi besok.";
      }
      const overview = await enrollInCourse(auth.userId, course.id);
      return NextResponse.json({ overview: overview ? toSyllabusOverview(overview) : null, warning }, { status: existing ? 200 : 201 });
    }
    return NextResponse.json({ error: "Aksi kursus tidak dikenali." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("[api/courses] POST", error);
    const safe = /topik|hasil yang ingin|Silabus|silabus|judul|tujuan|modul|kursus personal/i.test(message);
    return NextResponse.json({ error: safe ? message : "Kursus personal belum dapat disusun. Coba lagi." }, { status: safe ? 400 : 500 });
  }
}
