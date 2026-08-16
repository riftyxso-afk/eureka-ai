import { NextRequest, NextResponse } from "next/server";

import {
  deleteNote,
  getNoteWithChunks,
  updateNote,
} from "@/lib/rag/store";
import { requireAuth } from "@/lib/assistant/auth";
import { db } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Wajib login; kepemilikan dicek di bawah.
    const auth = await requireAuth(req.headers.get("authorization"));
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const found = await getNoteWithChunks(id);
    if (!found) {
      return NextResponse.json(
        { error: "Catatan tidak ditemukan." },
        { status: 404 }
      );
    }
    if (found.note.user_id !== auth.userId) {
      // Baca via link undangan (?invite=TOKEN) — token berlaku & belum kedaluwarsa.
      const inviteToken = req.nextUrl.searchParams.get("invite") ?? "";
      if (inviteToken) {
        const { data: invite } = await db()
          .from("invite_tokens")
          .select("token")
          .eq("token", inviteToken)
          .eq("note_id", id)
          .neq("status", "expired")
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        if (invite) {
          return NextResponse.json({
            note: found.note,
            chapters: found.note.chapters ?? [],
            chunks: found.chunks.map(({ id, text }) => ({ id, text })),
          });
        }
      }
      return NextResponse.json(
        { error: "Akses ditolak. Kamu bukan pemilik catatan ini." },
        { status: 403 }
      );
    }
    return NextResponse.json({
      note: found.note,
      chapters: found.note.chapters ?? [],
      chunks: found.chunks.map(({ id, text }) => ({ id, text })),
    });
  } catch (e) {
    const msg = "Gagal memuat catatan.";
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

    // Wajib login; kepemilikan dicek sebelum update.
    const auth = await requireAuth(req.headers.get("authorization"));
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

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

    const found = await getNoteWithChunks(id);
    if (!found) {
      return NextResponse.json(
        { error: "Catatan tidak ditemukan." },
        { status: 404 }
      );
    }
    if (found.note.user_id !== auth.userId) {
      return NextResponse.json(
        { error: "Akses ditolak. Kamu bukan pemilik catatan ini." },
        { status: 403 }
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
    const msg = "Gagal memperbarui catatan.";
    console.error("[api/notes/[id]] PATCH", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Hanya pemilik yang bisa menghapus — identitas dari token sesi.
    const auth = await requireAuth(req.headers.get("authorization"));
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const userId = auth.userId;

    const found = await getNoteWithChunks(id);
    if (!found) {
      return NextResponse.json(
        { error: "Catatan tidak ditemukan." },
        { status: 404 }
      );
    }
    if (found.note.user_id !== userId) {
      return NextResponse.json(
        { error: "Akses ditolak. Kamu bukan pemilik catatan ini." },
        { status: 403 }
      );
    }

    await deleteNote(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = "Gagal menghapus catatan.";
    console.error("[api/notes/[id]] DELETE", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
