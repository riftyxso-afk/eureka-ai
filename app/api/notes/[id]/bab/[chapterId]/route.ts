import { NextRequest, NextResponse } from "next/server";

import { getNoteWithChunks } from "@/lib/rag/store";
import { db } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; chapterId: string }> }
) {
  try {
    const { id, chapterId } = await params;
    const found = await getNoteWithChunks(id);
    if (!found) {
      return NextResponse.json(
        { error: "Catatan tidak ditemukan." },
        { status: 404 }
      );
    }
    const chapters = found.note.chapters ?? [];
    const chapterIndex = chapters.findIndex(
      (c) => String(c.id) === String(chapterId)
    );
    if (chapterIndex === -1) {
      return NextResponse.json(
        { error: "Bab tidak ditemukan." },
        { status: 404 }
      );
    }

    const { data } = await db()
      .from("chapter_notes")
      .select("content")
      .eq("note_id", id)
      .eq("chapter_id", Number(chapterId))
      .maybeSingle();

    return NextResponse.json({
      note: {
        id: found.note.id,
        title: found.note.title,
        subject: found.note.subject,
        createdAt: found.note.createdAt,
      },
      chapter: chapters[chapterIndex],
      userNote: data?.content ?? "",
      prev: chapterIndex > 0 ? chapters[chapterIndex - 1] : null,
      next:
        chapterIndex < chapters.length - 1
          ? chapters[chapterIndex + 1]
          : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal memuat bab.";
    console.error("[api/notes/[id]/bab/[chapterId] GET", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; chapterId: string }> }
) {
  try {
    const { id, chapterId } = await params;
    const body = (await req.json().catch(() => null)) as {
      content?: string;
    } | null;
    const content = String(body?.content ?? "").slice(0, 20000);

    const { data, error } = await db()
      .from("chapter_notes")
      .upsert({
        note_id: id,
        chapter_id: Number(chapterId),
        content,
      })
      .select("updated_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, updatedAt: data.updated_at });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal menyimpan catatan pribadi.";
    console.error("[api/notes/[id]/bab/[chapterId] PUT", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
