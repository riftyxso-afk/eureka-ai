import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

import { getNoteWithChunks } from "@/lib/rag/store";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");
const NOTES_FILE = path.join(DATA_DIR, "chapter-notes.json");

interface ChapterNoteEntry {
  content: string;
  updatedAt: string;
}

async function readChapterNotes(): Promise<Record<string, ChapterNoteEntry>> {
  try {
    const raw = await fs.readFile(NOTES_FILE, "utf-8");
    return JSON.parse(raw) as Record<string, ChapterNoteEntry>;
  } catch {
    return {};
  }
}

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

    const key = `${id}:${chapterId}`;
    const userNotes = await readChapterNotes();

    return NextResponse.json({
      note: {
        id: found.note.id,
        title: found.note.title,
        subject: found.note.subject,
        createdAt: found.note.createdAt,
      },
      chapter: chapters[chapterIndex],
      userNote: userNotes[key]?.content ?? "",
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

    const key = `${id}:${chapterId}`;
    const userNotes = await readChapterNotes();
    userNotes[key] = { content, updatedAt: new Date().toISOString() };

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(
      NOTES_FILE,
      JSON.stringify(userNotes, null, 2),
      "utf-8"
    );

    return NextResponse.json({ ok: true, updatedAt: userNotes[key].updatedAt });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal menyimpan catatan pribadi.";
    console.error("[api/notes/[id]/bab/[chapterId] PUT", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
