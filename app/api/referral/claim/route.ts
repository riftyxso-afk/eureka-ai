import { NextRequest, NextResponse } from "next/server";

import { claimReferralReward } from "@/lib/referral";
import { authorizeAssistantUser } from "@/lib/assistant/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/referral/claim
 * Body: { userId }
 * Klaim reward referral: berlaku bila rujukan valid sudah mencapai goal (5)
 * dan belum pernah rewarded → aktifkan premium 30 hari (sekali pakai).
 * Idempoten: sudah rewarded → { ok, alreadyClaimed: true }.
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

    const result = await claimReferralReward(auth.userId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      alreadyClaimed: result.alreadyClaimed === true,
      premiumUntil: result.premiumUntil ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal klaim reward.";
    console.error("[api/referral/claim] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
