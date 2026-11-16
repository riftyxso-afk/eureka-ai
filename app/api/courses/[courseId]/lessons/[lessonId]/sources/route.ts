import { NextRequest, NextResponse } from "next/server";
import { requireCourseAccess } from "@/lib/courses/access";
import { getLessonForUser } from "@/lib/courses/server";
import { firecrawlSearch } from "@/lib/firecrawl";
import { findStudySources, hasZapi } from "@/lib/zapi-study";

export const runtime = "nodejs";
type Context = { params: Promise<{ courseId: string; lessonId: string }> };

export async function GET(req: NextRequest, { params }: Context) {
  const auth = await requireCourseAccess(req.headers.get("authorization"));
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const { courseId, lessonId } = await params;
    const found = await getLessonForUser(auth.userId, courseId, lessonId);
    if (!found) return NextResponse.json({ error: "Pelajaran tidak ditemukan." }, { status: 404 });
    const { course, lesson } = found;
    const query = `${course.title} ${lesson.title}`.slice(0, 180);
    const stop = new Set(["yang", "dan", "untuk", "dari", "dalam", "dasar", "pelajaran", "kursus", "materi", "belajar", "konsep", "praktik", "pada", "dengan"]);
    const terms = [...new Set(`${course.title} ${lesson.title}`.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])].filter(word => !stop.has(word));
    const relevant = (title: string, description: string) => terms.length > 0 && terms.some(word => `${title} ${description}`.toLowerCase().includes(word));
    const [web, videos] = await Promise.allSettled([
      firecrawlSearch(query, 6, AbortSignal.timeout(12000)),
      hasZapi() ? findStudySources("video", query) : Promise.resolve([]),
    ]);
    const sources = [
      ...(web.status === "fulfilled" ? web.value.filter(item => relevant(item.title, item.description)).slice(0, 3).map(item => ({ id: item.url, title: item.title, url: item.url, note: "Artikel web" })) : []),
      ...(videos.status === "fulfilled" ? videos.value.filter(item => relevant(item.title, item.excerpt)).slice(0, 3).map(item => ({ id: item.url, title: item.title, url: item.url, note: "Video YouTube" })) : []),
    ];
    return NextResponse.json({ sources });
  } catch (error) {
    console.error("[course sources]", error);
    return NextResponse.json({ error: "Sumber belum dapat dicari." }, { status: 500 });
  }
}
