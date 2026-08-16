import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/assistant/auth";
import { getNoteWithChunks } from "@/lib/rag/store";
import { listPresence, setPresence, type CollabRole } from "@/lib/collab";

export const runtime = "nodejs";

const MAX_POLL_SECONDS = 60;

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
    const presence = await listPresence(id);
    return NextResponse.json({ presence });
  } catch (e) {
    const msg = "Gagal memuat kehadiran.";
    console.error("[api/notes/[id]/presence] GET", e);
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
    const body = (await req.json().catch(() => null)) as {
      userId?: string;
      name?: string;
      role?: string;
    } | null;

    const userId = auth.userId;
    if (!(await ensureNoteExists(id))) {
      return NextResponse.json(
        { error: "Catatan tidak ditemukan." },
        { status: 404 }
      );
    }

    const role: CollabRole = body?.role === "editor" ? "editor" : "viewer";
    await setPresence(id, userId, {
      name: String(body?.name ?? "Pengguna").slice(0, 60),
      role,
      lastActive: Date.now(),
    });

    return NextResponse.json({
      presence: await listPresence(id),
      pollInterval: MAX_POLL_SECONDS,
    });
  } catch (e) {
    const msg = "Gagal memperbarui kehadiran.";
    console.error("[api/notes/[id]/presence] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
