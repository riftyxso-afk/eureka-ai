import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/assistant/auth";
import {
  gradeEssayAnswers,
  type ComprehensionQuestion,
} from "@/lib/studyTools";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: NextRequest
) {
  try {
    const auth = await requireAuth(req.headers.get("authorization"));
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const body = (await req.json().catch(() => null)) as {
      questions?: ComprehensionQuestion[];
      answers?: Record<number, string>;
    } | null;

    const questions = Array.isArray(body?.questions) ? body!.questions : [];
    const answers = (body?.answers ?? {}) as Record<number, string>;
    if (questions.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada soal untuk dinilai." },
        { status: 400 }
      );
    }

    const grades = await gradeEssayAnswers(questions, answers);
    return NextResponse.json({ grades });
  } catch (e) {
    const msg = "Gagal menilai jawaban essay.";
    console.error("[api/notes/[id]/comprehension/grade]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
