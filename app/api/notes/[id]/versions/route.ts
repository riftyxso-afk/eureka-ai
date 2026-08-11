import { NextRequest, NextResponse } from "next/server";

import { getNoteWithChunks, updateNote } from "@/lib/rag/store";
import {
  addVersion,
  getVersion,
  listVersions,
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
    return NextResponse.json({ versions: await listVersions(id) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal memuat riwayat versi.";
    console.error("[api/notes/[id]/versions] GET", e);
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
      title?: string;
      summary?: string;
      changedBy?: string;
      version?: number;
    } | null;

    if (!(await ensureNoteExists(id))) {
      return NextResponse.json(
        { error: "Catatan tidak ditemukan." },
        { status: 404 }
      );
    }

    if (body?.action === "restore") {
      const version = await getVersion(id, Number(body.version));
      if (!version) {
        return NextResponse.json(
          { error: "Versi tidak ditemukan." },
          { status: 404 }
        );
      }
      await updateNote(id, {
        title: version.title,
        summary: version.summary,
      });
      return NextResponse.json({ ok: true, restored: version });
    }

    // Simpan versi baru (dari edit judul/ringkasan)
    const title = String(body?.title ?? "").trim();
    if (!title) {
      return NextResponse.json(
        { error: "Judul tidak boleh kosong." },
        { status: 400 }
      );
    }
    const version = await addVersion(id, {
      title,
      summary: String(body?.summary ?? "").slice(0, 1000),
      changedBy: String(body?.changedBy ?? "Pengguna").slice(0, 60),
    });
    return NextResponse.json({ version });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal memproses versi.";
    console.error("[api/notes/[id]/versions] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
