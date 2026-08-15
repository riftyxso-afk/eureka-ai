import { NextRequest, NextResponse } from "next/server";

import { authorizeAssistantUser } from "@/lib/assistant/auth";
import { db } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/beta/join
 * Body: { userId: string }
 * Aktifkan akses beta tester (is_beta = true) — idempotent.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      userId?: unknown;
    } | null;
    const rawUserId = String(body?.userId ?? "").trim();

    const auth = await authorizeAssistantUser(
      req.headers.get("authorization"),
      rawUserId
    );
    if (!auth.userId) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status ?? 401 }
      );
    }

    const { data: user, error: userErr } = await db()
      .from("users")
      .select("is_beta")
      .eq("id", auth.userId)
      .maybeSingle();
    if (userErr || !user) {
      return NextResponse.json(
        { error: "Akun tidak ditemukan." },
        { status: 404 }
      );
    }

    const already = user.is_beta === true;

    if (!already) {
      const { error: updErr } = await db()
        .from("users")
        .update({
          is_beta: true,
          beta_joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", auth.userId);
      if (updErr) {
        console.error("[api/beta/join] update gagal:", updErr);
        return NextResponse.json(
          { error: "Gagal mengaktifkan beta, coba lagi." },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ ok: true, isBeta: true, already });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal join beta.";
    console.error("[api/beta/join] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
