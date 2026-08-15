import { NextRequest, NextResponse } from "next/server";

import { getPremiumStatus } from "@/lib/premium";
import { authorizeAssistantUser } from "@/lib/assistant/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/payments/status?userId=...
 * Mengembalikan status premium user yang terautentikasi:
 *   { isPremium, tier, premiumUntil }
 */
export async function GET(req: NextRequest) {
  try {
    const rawUserId = String(
      req.nextUrl.searchParams.get("userId") ?? ""
    ).trim();
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

    const status = await getPremiumStatus(auth.userId);
    return NextResponse.json(status);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal memuat status premium.";
    console.error("[api/payments/status] GET", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
