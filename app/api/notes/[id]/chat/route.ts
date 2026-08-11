import { NextRequest, NextResponse } from "next/server";

import { getNoteWithChunks } from "@/lib/rag/store";
import { addChatMessage, listChatMessages } from "@/lib/collab";

export const runtime = "nodejs";

/** Ekstrak nama yang disebut via @mention dari teks pesan. */
function extractMentions(content: string): string[] {
  const mentions = new Set<string>();
  const regex = /@([^\s@]+(?:\s+[^\s@]+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const name = match[1]
      .replace(/[.,!?;:]+$/, "")
      .trim();
    if (name.length >= 2) mentions.add(name);
  }
  return Array.from(mentions).slice(0, 10);
}

async function ensureNoteExists(noteId: string): Promise<boolean> {
  const found = await getNoteWithChunks(noteId);
  return found !== null;
}

export async function GET(
  req: NextRequest,
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
    const after = Number(req.nextUrl.searchParams.get("after") ?? 0);
    const messages = await listChatMessages(id);
    return NextResponse.json({
      messages: after > 0 ? messages.filter((m) => Date.parse(m.createdAt) > after) : messages,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal memuat chat.";
    console.error("[api/notes/[id]/chat] GET", e);
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
      senderName?: string;
      content?: string;
      parentId?: string;
    } | null;

    const content = String(body?.content ?? "").trim().slice(0, 2000);
    if (!content) {
      return NextResponse.json(
        { error: "Pesan tidak boleh kosong." },
        { status: 400 }
      );
    }
    if (!(await ensureNoteExists(id))) {
      return NextResponse.json(
        { error: "Catatan tidak ditemukan." },
        { status: 404 }
      );
    }

    const message = await addChatMessage(
      id,
      String(body?.senderName ?? "Pengguna").slice(0, 60),
      content,
      {
        parentId: body?.parentId || undefined,
        isAI: false,
        mentions: extractMentions(content),
      }
    );
    return NextResponse.json({ message });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal mengirim pesan.";
    console.error("[api/notes/[id]/chat] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
