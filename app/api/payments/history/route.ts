import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/supabase/admin";
import { authorizeAssistantUser } from "@/lib/assistant/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIER_LABEL: Record<string, string> = {
  promo: "Promo",
  normal: "Normal",
  trial: "Trial",
};

/**
 * GET /api/payments/history?userId=...
 * Mengembalikan status premium terkini + riwayat order pembayaran milik user:
 *   {
 *     plan: { isPremium, tier, premiumUntil, trialClaimedAt, lastInvoice },
 *     history: [{ orderId, amount, tier, status, paidAt, createdAt }]
 *   }
 * Hanya data user pemanggil (otorisasi bearer token + pencocokan userId).
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
    const userId = auth.userId;

    const [userRes, historyRes] = await Promise.all([
      db()
        .from("users")
        .select(
          "is_premium, premium_tier, premium_until, trial_claimed_at, pakasir_invoice_number"
        )
        .eq("id", userId)
        .maybeSingle(),
      db()
        .from("pakasir_payment_requests")
        .select("order_id, amount, tier, status, paid_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);

    if (userRes.error) throw userRes.error;
    if (historyRes.error) throw historyRes.error;

    const user = userRes.data as
      | {
          is_premium: boolean | null;
          premium_tier: string | null;
          premium_until: string | null;
          trial_claimed_at: string | null;
          pakasir_invoice_number: string | null;
        }
      | null;

    const history = (historyRes.data ?? []).map((h) => ({
      orderId: h.order_id,
      amount: Number(h.amount) || 0,
      tier: TIER_LABEL[String(h.tier ?? "")] ?? String(h.tier ?? "normal"),
      status: h.status,
      paidAt: h.paid_at ?? null,
      createdAt: h.created_at ?? null,
    }));

    return NextResponse.json({
      plan: {
        isPremium: user?.is_premium === true,
        tier: user?.premium_tier ?? null,
        premiumUntil: user?.premium_until ?? null,
        trialClaimedAt: user?.trial_claimed_at ?? null,
        lastInvoice: user?.pakasir_invoice_number ?? null,
      },
      history,
    });
  } catch (e) {
    const msg = "Gagal memuat riwayat pembelian.";
    console.error("[api/payments/history] GET", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
