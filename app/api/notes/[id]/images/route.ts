import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { randomUUID } from "crypto";

import { requireAuth } from "@/lib/assistant/auth";
import { getNoteWithChunks } from "@/lib/rag/store";
import {
  addImage,
  listImages,
  removeImage,
  type ImageAlignment,
  type ImageSize,
} from "@/lib/note-images-store";
import { uploadNoteImage, deleteNoteImage } from "@/lib/noteImageStorage";

export const runtime = "nodejs";

async function ensureOwner(
  noteId: string,
  userId: string
): Promise<NextResponse | null> {
  const found = await getNoteWithChunks(noteId);
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
  return null;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXT = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

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
    const denied = await ensureOwner(id, auth.userId);
    if (denied) return denied;
    const images = await listImages(id);
    return NextResponse.json({ images });
  } catch (e) {
    const msg = "Gagal memuat gambar.";
    console.error("[api/notes/[id]/images] GET", e);
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
    const denied = await ensureOwner(id, auth.userId);
    if (denied) return denied;
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string" || !("arrayBuffer" in file)) {
      return NextResponse.json(
        { error: "File gambar diperlukan." },
        { status: 400 }
      );
    }
    const upload = file as File;
    if (upload.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Ukuran gambar maksimal 5 MB." },
        { status: 400 }
      );
    }
    const ext = path.extname(upload.name).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return NextResponse.json(
        { error: "Format gambar harus PNG, JPG, WEBP, atau GIF." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await upload.arrayBuffer());
    const filename = `${randomUUID()}${ext}`;
    const url = await uploadNoteImage(id, filename, buffer, upload.type || "image/jpeg");
    if (!url) {
      return NextResponse.json(
        { error: "Gagal menyimpan gambar ke penyimpanan." },
        { status: 500 }
      );
    }

    const alignment: ImageAlignment =
      form.get("alignment") === "left" || form.get("alignment") === "right"
        ? (form.get("alignment") as ImageAlignment)
        : "center";
    const size: ImageSize =
      form.get("size") === "small" || form.get("size") === "large"
        ? (form.get("size") as ImageSize)
        : "medium";
    const chapterIdRaw = Number(form.get("chapterId"));
    const caption = String(form.get("caption") ?? "").trim().slice(0, 200);

    const image = await addImage({
      noteId: id,
      chapterId: Number.isFinite(chapterIdRaw) && chapterIdRaw > 0 ? chapterIdRaw : undefined,
      url,
      caption: caption || undefined,
      alignment,
      size,
      source: "upload",
    });

    return NextResponse.json({ image });
  } catch (e) {
    const msg = "Gagal mengunggah gambar.";
    console.error("[api/notes/[id]/images] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req.headers.get("authorization"));
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await params;
    const denied = await ensureOwner(id, auth.userId);
    if (denied) return denied;
    const imageId = String(req.nextUrl.searchParams.get("id") ?? "");
    if (!imageId) {
      return NextResponse.json(
        { error: "id gambar diperlukan." },
        { status: 400 }
      );
    }
    const result = await removeImage(id, imageId);
    if (result.ok && result.url) {
      // Hapus objek Supabase Storage (URL absolut) — legacy path lokal no-op.
      await deleteNoteImage(result.url);
    }
    return NextResponse.json({ ok: result.ok });
  } catch (e) {
    const msg = "Gagal menghapus gambar.";
    console.error("[api/notes/[id]/images] DELETE", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
