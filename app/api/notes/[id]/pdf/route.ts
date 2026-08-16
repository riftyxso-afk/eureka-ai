/**
 * GET /api/notes/:id/pdf — Unduh rangkuman catatan sebagai PDF.
 *
 * Disusun menyerupai struktur skripsi/laporan resmi (sampul, kata pengantar,
 * daftar isi, BAB berparagraf, penutup) — mesin pdfkit (Node).
 * Versi dengan alur kerja realtime + Python ada di ./stream.
 */
import { NextRequest, NextResponse } from "next/server";

import { getNoteWithChunks } from "@/lib/rag/store";
import { buildNotePdfBuffer } from "@/lib/notePdf";
import { recordActivity } from "@/lib/progress-store";
import { requireAuth } from "@/lib/assistant/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = String(req.nextUrl.searchParams.get("userId") ?? "").trim();

    // Wajib login; userId dari query harus cocok dengan token sesi.
    const auth = await requireAuth(req.headers.get("authorization"), userId);
    if (auth.error) {
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
      return NextResponse.json(
        { error: "Akses ditolak. Kamu bukan pemilik catatan ini." },
        { status: 403 }
      );
    }

    const note = found.note;
    const pdfBuffer = await buildNotePdfBuffer(note);

    // Catat aktivitas (XP kecil).
    try {
      await recordActivity(userId, 5, "Mengunduh dokumen PDF catatan");
    } catch {
      // abaikan
    }

    const title = note.title || "Rangkuman Materi";
    const filename = `${title.replace(/[^\w\- ]+/g, "").trim().slice(0, 40) || "rangkuman"}.pdf`;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    const msg = "Gagal membuat PDF.";
    console.error("[api/notes/[id]/pdf]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
