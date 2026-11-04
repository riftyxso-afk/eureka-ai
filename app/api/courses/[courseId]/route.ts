import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/assistant/auth";
import { enrollInCourse, getCourseOverview } from "@/lib/courses/server";
import { toSyllabusOverview } from "@/lib/courses/dto";

export const runtime = "nodejs";

type Context = { params: Promise<{ courseId: string }> };

export async function GET(req: NextRequest, { params }: Context) {
  const auth = await requireAuth(req.headers.get("authorization"));
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const overview = await getCourseOverview(auth.userId, (await params).courseId);
    if (!overview) return NextResponse.json({ error: "Kursus tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ overview: toSyllabusOverview(overview) });
  } catch (error) {
    console.error("[api/courses/[courseId]] GET", error);
    const message = error instanceof Error && error.message.includes("bukan milikmu") ? error.message : "Detail kursus belum dapat dimuat.";
    return NextResponse.json({ error: message }, { status: message.includes("bukan milikmu") ? 403 : 500 });
  }
}

export async function POST(req: NextRequest, { params }: Context) {
  const auth = await requireAuth(req.headers.get("authorization"));
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const overview = await enrollInCourse(auth.userId, (await params).courseId);
    if (!overview) return NextResponse.json({ error: "Kursus tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ overview: toSyllabusOverview(overview) });
  } catch (error) {
    console.error("[api/courses/[courseId]] POST", error);
    return NextResponse.json({ error: "Kursus belum dapat ditambahkan ke daftar belajarmu." }, { status: 500 });
  }
}
