import { NextRequest, NextResponse } from "next/server";

import { getSubjects, addSubject } from "@/lib/subjects-store";
import { listNotes } from "@/lib/rag/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [subjects, notes] = await Promise.all([getSubjects(), listNotes()]);
    // totalNotes dihitung live dari catatan yang subject-nya sama
    const withCount = subjects.map((s) => ({
      ...s,
      totalNotes: notes.filter((n) => n.subject === s.name).length,
    }));
    return NextResponse.json({ subjects: withCount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal memuat mata pelajaran.";
    console.error("[api/subjects]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const subject = await addSubject({
      name: String(body?.name ?? ""),
      emoji: body?.emoji ? String(body.emoji) : undefined,
      color: body?.color ? String(body.color) : undefined,
    });
    return NextResponse.json({ subject }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal menambah mata pelajaran.";
    console.error("[api/subjects POST]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
