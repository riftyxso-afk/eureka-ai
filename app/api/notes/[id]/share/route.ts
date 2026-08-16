import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

import { getNoteWithChunks } from "@/lib/rag/store";
import { getUserIdFromAuth } from "@/lib/assistant/auth";
import { db } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * POST /api/notes/[id]/share — buat link publik read-only untuk catatan.
 * Hanya pemilik catatan yang bisa membuat. Token unik tidak bisa ditebak.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const userId = await getUserIdFromAuth(req.headers.get("authorization"));
    if (!userId) {
      return NextResponse.json(
        { error: "Autentikasi diperlukan. Silakan masuk ulang." },
        { status: 401 }
      );
    }

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

    // Buat token unik; reuse token lama milik catatan ini bila ada.
    const existing = await db()
      .from("note_shares")
      .select("token")
      .eq("note_id", id)
      .maybeSingle();
    let token: string;
    if (existing.data?.token) {
      token = existing.data.token;
    } else {
      token = randomBytes(24).toString("hex");
      const { error: insertError } = await db()
        .from("note_shares")
        .insert({ note_id: id, token });
      if (insertError) {
        console.error("[api/notes/[id]/share]", insertError);
        return NextResponse.json(
          { error: "Gagal membuat link share." },
          { status: 500 }
        );
      }
    }

    // Link publik harus mengarah ke FRONTEND (Vercel), bukan ke domain API
    // backend (req.url origin = api-eureka.web.id / localhost:3001 saat request
    // diproses backend Hono). Pakai NEXT_PUBLIC_SITE_URL dengan fallback
    // hardcoded — pola sama seperti app/api/referral/route.ts.
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.eureka-ai.web.id";
    return NextResponse.json({
      token,
      url: `${siteUrl.replace(/\/+$/, "")}/share/note/${token}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal membuat link share.";
    console.error("[api/notes/[id]/share]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
