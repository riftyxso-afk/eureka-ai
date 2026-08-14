import { NextRequest, NextResponse } from "next/server";

import { claimTrial } from "@/lib/premium";
import { authorizeAssistantUser } from "@/lib/assistant/auth";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/trial
 * Body: { userId: string }
 * Klaim trial gratis 7 hari — sekali seumur hidup.
 * Response: { ok, premiumUntil } | { error }
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

    // Rate limit: maks 5 percobaan/jam per user (anti-bot spam claim).
    ensureRateLimitPrune();
    const rl = checkRateLimit(`trial:${auth.userId}`, 5, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu sering mencoba. Tunggu sebentar ya 🙏" },
        { status: 429 }
      );
    }

    const result = await claimTrial(auth.userId);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 400 }
      );
    }
    return NextResponse.json({ ok: true, premiumUntil: result.premiumUntil });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal mengaktifkan trial.";
    console.error("[api/payments/trial] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
