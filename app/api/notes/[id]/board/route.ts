import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/assistant/auth";
import { getNoteWithChunks } from "@/lib/rag/store";
import {
  addBoardStroke,
  clearBoard,
  getBoard,
  type BoardStroke,
} from "@/lib/whiteboard-store";
import { listPresence } from "@/lib/collab";

export const runtime = "nodejs";

async function ensureNoteExists(noteId: string): Promise<boolean> {
  const found = await getNoteWithChunks(noteId);
  return found !== null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req.headers.get("authorization"));
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await params;
    if (!(await ensureNoteExists(id))) {
      return NextResponse.json(
        { error: "Catatan tidak ditemukan." },
        { status: 404 }
      );
    }
    const [board, presence] = await Promise.all([
      getBoard(id),
      listPresence(id),
    ]);
    return NextResponse.json({
      strokes: board.strokes,
      clearedAt: board.clearedAt,
      presence: Object.values(presence),
    });
  } catch (e) {
    const msg = "Gagal memuat papan tulis.";
    console.error("[api/notes/[id]/board] GET", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req.headers.get("authorization"));
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await params;
    if (!(await ensureNoteExists(id))) {
      return NextResponse.json(
        { error: "Catatan tidak ditemukan." },
        { status: 404 }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      action?: string;
      stroke?: Omit<BoardStroke, "id" | "createdAt">;
    } | null;

    if (body?.action === "stroke" && body.stroke) {
      const s = body.stroke;
      if (!Array.isArray(s.points) || s.points.length < 2) {
        return NextResponse.json(
          { error: "Goresan tidak valid." },
          { status: 400 }
        );
      }
      const stroke = await addBoardStroke(id, {
        authorId: String(s.authorId ?? "").slice(0, 40),
        authorName: String(s.authorName ?? "Pengguna").slice(0, 60),
        color: String(s.color ?? "#3B2F2F").slice(0, 20),
        size: Math.min(30, Math.max(1, Number(s.size) || 3)),
        points: s.points.map((p) => [
          Math.round(Number(p[0]) || 0),
          Math.round(Number(p[1]) || 0),
        ]),
      });
      return NextResponse.json({ stroke });
    }

    if (body?.action === "clear") {
      const clearedAt = await clearBoard(id);
      return NextResponse.json({ clearedAt });
    }

    return NextResponse.json(
      { error: "Aksi tidak dikenali." },
      { status: 400 }
    );
  } catch (e) {
    const msg = "Gagal menyimpan papan tulis.";
    console.error("[api/notes/[id]/board] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
