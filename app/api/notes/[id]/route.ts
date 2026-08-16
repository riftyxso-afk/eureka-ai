import { NextRequest, NextResponse } from "next/server";

import { getNoteWithChunks, updateNote } from "@/lib/rag/store";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const found = await getNoteWithChunks(id);
    if (!found) {
      return NextResponse.json(
        { error: "Catatan tidak ditemukan." },
        { status: 404 }
      );
    }
    return NextResponse.json({
      note: found.note,
      chapters: found.note.chapters ?? [],
      chunks: found.chunks.map(({ id, text }) => ({ id, text })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal memuat catatan.";
    console.error("[api/notes/[id]]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as {
      title?: string;
      summary?: string;
      /** Toggle semat (pin) catatan. */
      pinned?: boolean;
    } | null;

    // Judul hanya wajib bila body mengubah judul; pin boleh dikirim sendiri.
    const hasTitle = typeof body?.title === "string";
    const hasPinned = typeof body?.pinned === "boolean";
    if (!hasTitle && !hasPinned) {
      return NextResponse.json(
        { error: "Tidak ada field yang diubah." },
        { status: 400 }
      );
    }
    const title = hasTitle ? String(body!.title).trim().slice(0, 200) : undefined;
    if (hasTitle && !title) {
      return NextResponse.json(
        { error: "Judul tidak boleh kosong." },
        { status: 400 }
      );
    }
    const updated = await updateNote(id, {
      ...(title !== undefined ? { title } : {}),
      summary: body?.summary !== undefined
        ? String(body.summary).slice(0, 1200)
        : undefined,
      ...(hasPinned ? { pinned: body!.pinned === true } : {}),
    });
    if (!updated) {
      return NextResponse.json(
        { error: "Catatan tidak ditemukan." },
        { status: 404 }
      );
    }
    return NextResponse.json({ note: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal memperbarui catatan.";
    console.error("[api/notes/[id]] PATCH", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
