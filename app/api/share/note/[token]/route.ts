import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/share/note/[token] — akses publik (tanpa login).
 * Mengembalikan snapshot read-only catatan (id, judul, bab, subjek)
 * via fungsi security definer get_public_note_by_token.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const safeToken = String(token ?? "").trim().slice(0, 100);
    if (!safeToken) {
      return NextResponse.json(
        { error: "Link tidak valid." },
        { status: 404 }
      );
    }

    const { data, error } = await db().rpc("get_public_note_by_token", {
      p_token: safeToken,
    });

    if (error) {
      console.error("[api/share/note/[token]]", error);
      return NextResponse.json(
        { error: "Gagal memuat catatan." },
        { status: 500 }
      );
    }
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) {
      return NextResponse.json(
        { error: "Catatan tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      note: {
        id: row.id,
        title: row.title ?? "Tanpa Judul",
        subject: row.subject ?? "",
        chapters: row.chapters ?? [],
      },
    });
  } catch (e) {
    console.error("[api/share/note/[token]]", e);
    return NextResponse.json(
      { error: "Gagal memuat catatan." },
      { status: 500 }
    );
  }
}
