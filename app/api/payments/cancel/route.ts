import { NextRequest, NextResponse } from "next/server";

import { cancelSubscription } from "@/lib/premium";
import { authorizeAssistantUser } from "@/lib/assistant/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/cancel
 * Body: { userId: string }
 * Batalkan langganan premium — akses berhenti sekarang, TANPA refund.
 * (Langganan Eureka sangat murah sehingga tidak ada pengembalian dana.)
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

    const result = await cancelSubscription(auth.userId);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 400 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = "Gagal membatalkan langganan.";
    console.error("[api/payments/cancel] POST", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
