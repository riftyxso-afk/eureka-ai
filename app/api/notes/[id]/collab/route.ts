import { NextRequest, NextResponse } from "next/server";

import { getNoteWithChunks } from "@/lib/rag/store";
import {
  acceptInvite,
  addCollaborator,
  getNoteCollab,
  removeCollaborator,
  type CollabRole,
} from "@/lib/collab";

export const runtime = "nodejs";

async function ensureNoteExists(noteId: string): Promise<boolean> {
  const found = await getNoteWithChunks(noteId);
  return found !== null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!(await ensureNoteExists(id))) {
      return NextResponse.json(
        { error: "Catatan tidak ditemukan." },
        { status: 404 }
      );
    }
    const collab = await getNoteCollab(id);
    return NextResponse.json({
      inviteLink: `/dashboard/note/${id}?invite=${collab.inviteToken}`,
      collaborators: collab.collaborators,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal memuat kolaborasi.";
    console.error("[api/notes/[id]/collab] GET", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as {
      action?: string;
      name?: string;
      role?: string;
      token?: string;
      collaboratorId?: string;
    } | null;

    if (!(await ensureNoteExists(id))) {
      return NextResponse.json(
        { error: "Catatan tidak ditemukan." },
        { status: 404 }
      );
    }

    switch (body?.action) {
      case "invite": {
        const name = String(body.name ?? "").trim().slice(0, 60);
        if (!name) {
          return NextResponse.json(
            { error: "Nama teman tidak boleh kosong." },
            { status: 400 }
          );
        }
        const role: CollabRole = body.role === "editor" ? "editor" : "viewer";
        const { collaborator, inviteToken } = await addCollaborator(
          id,
          name,
          role
        );
        return NextResponse.json({
          collaborator,
          inviteLink: `/dashboard/note/${id}?invite=${inviteToken}`,
        });
      }
      case "join": {
        const token = String(body.token ?? "");
        const accepted = await acceptInvite(id, token);
        if (!accepted) {
          return NextResponse.json(
            { error: "Link undangan tidak valid." },
            { status: 400 }
          );
        }
        return NextResponse.json({ ok: true });
      }
      case "remove": {
        const collaboratorId = String(body.collaboratorId ?? "");
        if (!collaboratorId) {
          return NextResponse.json(
            { error: "ID kolaborator tidak valid." },
            { status: 400 }
          );
        }
        await removeCollaborator(id, collaboratorId);
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json(
          { error: "Aksi tidak dikenali." },
          { status: 400 }
        );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal memproses kolaborasi.";
    console.error("[api/notes/[id]/collab] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
