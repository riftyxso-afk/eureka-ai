import { NextRequest, NextResponse } from "next/server";

import { getUserIdFromAuth } from "@/lib/assistant/auth";
import { db } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/beta/status
 * Cek status beta tester user saat ini.
 * Response: { isBeta: boolean } | { error }
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromAuth(req.headers.get("authorization"));
    if (!userId) {
      return NextResponse.json(
        { error: "Autentikasi diperlukan." },
        { status: 401 }
      );
    }

    const { data } = await db()
      .from("users")
      .select("is_beta, beta_joined_at")
      .eq("id", userId)
      .maybeSingle();

    return NextResponse.json({
      isBeta: data?.is_beta === true,
      joinedAt: data?.beta_joined_at ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal cek status beta.";
    console.error("[api/beta/status] GET", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
