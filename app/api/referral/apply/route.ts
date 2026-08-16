import { NextRequest, NextResponse } from "next/server";

import { applyReferral } from "@/lib/referral";
import { authorizeAssistantUser } from "@/lib/assistant/auth";
import { db } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/referral/apply
 * Body: { userId, ref }
 * Catat atribusi referral untuk akun yang baru mendaftar lewat link ?ref=...
 * (dipakai jalur Google OAuth dari halaman callback). Best-effort: kode
 * tidak valid / self-referral / bukan akun baru → diabaikan, tidak error.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      userId?: unknown;
      ref?: unknown;
    } | null;
    const rawUserId = String(body?.userId ?? "").trim();
    const ref = String(body?.ref ?? "").trim().slice(0, 32);

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

    if (!ref) {
      return NextResponse.json({ ok: true, skipped: "no ref" });
    }

    // Email user (untuk cek anti self-referral / email sama).
    const { data: user } = await db()
      .from("users")
      .select("email, referred_by")
      .eq("id", auth.userId)
      .maybeSingle();
    const email = user?.email ? String(user.email) : "";

    // Hanya atribusi untuk akun yang belum punya pengundang.
    if (user?.referred_by) {
      return NextResponse.json({ ok: true, skipped: "already attributed" });
    }

    await applyReferral(auth.userId, email, ref);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = "Gagal memproses referral.";
    console.error("[api/referral/apply] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
