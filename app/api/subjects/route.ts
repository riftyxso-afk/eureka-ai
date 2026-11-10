import { NextRequest, NextResponse } from "next/server";

import { getSubjects, addSubject } from "@/lib/subjects-store";
import { listNotes } from "@/lib/rag/store";
import { requirePro } from "@/lib/assistant/auth";
import { db } from "@/lib/supabase/admin";
import { buildSubjectJourney } from "@/lib/subject-journey";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePro(req.headers.get("authorization"));
    const userId = auth.userId;
    if (!userId) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status ?? 401 }
      );
    }
    const [subjects, notes] = await Promise.all([
      getSubjects(userId),
      listNotes(userId || undefined),
    ]);
    // totalNotes dihitung live dari catatan yang subject-nya sama
    const includeJourney = req.nextUrl.searchParams.get("journey") === "1";
    let cards = null;
    if (includeJourney) {
      const result = await db().from("flashcards").select("note_id, review_count, due_date").eq("user_id", userId);
      if (!result.error) cards = result.data;
    }
    const withCount = subjects.map((s) => ({
      ...s,
      totalNotes: notes.filter((n) => n.subject === s.name).length,
      ...(includeJourney ? { journey: buildSubjectJourney({ id: userId }, s.name, notes, cards) } : {}),
    }));
    return NextResponse.json({ subjects: withCount });
  } catch (e) {
    const msg = "Gagal memuat mata pelajaran.";
    console.error("[api/subjects]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePro(req.headers.get("authorization"));
    const userId = auth.userId;
    if (!userId) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status ?? 401 }
      );
    }
    const body = await req.json();
    const subject = await addSubject(
      {
        name: String(body?.name ?? ""),
        emoji: body?.emoji ? String(body.emoji) : undefined,
        color: body?.color ? String(body.color) : undefined,
      },
      userId
    );
    return NextResponse.json({ subject }, { status: 201 });
  } catch (e) {
    const msg = "Gagal menambah mata pelajaran.";
    console.error("[api/subjects POST]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
