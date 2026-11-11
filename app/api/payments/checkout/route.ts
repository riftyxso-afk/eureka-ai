import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createMayarCheckout, isMayarConfigured } from "@/lib/mayar";
import { TIER_PRICES } from "@/lib/paymentPricing";
import { applyDiscount, consumeDiscount } from "@/lib/discount";
import { requireAuth } from "@/lib/assistant/auth";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";
import { db } from "@/lib/supabase/admin";
import { getFreeProUntil } from "@/lib/free-pro-period";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const auth = await requireAuth(req.headers.get("authorization"), typeof body?.userId === "string" ? body.userId.trim() : undefined);
  if (!auth.userId) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const freeAccessUntil = getFreeProUntil();
  if (freeAccessUntil) {
    return NextResponse.json({ error: "Eureka Pro sedang gratis untuk semua akun.", freeAccessUntil }, { status: 409 });
  }

  if (!isMayarConfigured()) {
    return NextResponse.json({ error: "Pembayaran Mayar belum tersedia. Silakan coba lagi nanti." }, { status: 503 });
  }
  ensureRateLimitPrune();
  if (!checkRateLimit(`mayar-checkout:${auth.userId}`, 8, 60_000).ok) {
    return NextResponse.json({ error: "Terlalu banyak percobaan checkout. Coba lagi sebentar." }, { status: 429 });
  }

  const tier = "normal";
  const orderId = randomUUID();
  const client = db();
  const discountCode = typeof body?.discountCode === "string" ? body.discountCode.trim() : "";
  try {
    const { data: user, error } = await client.from("users").select("email").eq("id", auth.userId).maybeSingle();
    if (error || !user?.email) {
      return NextResponse.json({ error: "Email akun tidak ditemukan." }, { status: 404 });
    }

    let amount: number = TIER_PRICES[tier];
    let discountLabel: string | null = null;
    if (discountCode) {
      const discount = await applyDiscount(discountCode, amount);
      if (!discount.ok) return NextResponse.json({ error: discount.error }, { status: 400 });
      if (discount.free) {
        const previous = await client.from("pakasir_payment_requests").select("order_id").eq("user_id", auth.userId).in("amount", [0, 500]).limit(1);
        if (previous.error) throw new Error("Could not validate previous discount.");
        if (previous.data?.length) return NextResponse.json({ error: "Kode gratis hanya bisa dipakai 1x per akun." }, { status: 409 });
      }
      amount = discount.finalAmount;
      discountLabel = discount.label;
    }

    const locale = req.headers.get("x-locale") === "en" ? "en" : "id";
    const origin = process.env.EUREKA_APP_URL?.trim() || "https://www.eureka-ai.web.id";
    const returnUrl = new URL(`/${locale}/payments/return`, origin);
    returnUrl.searchParams.set("order", orderId);

    const request = await client.from("mayar_payment_requests").insert({ order_id: orderId, user_id: auth.userId, amount, tier });
    if (request.error?.code === "23505" && amount === 500) {
      return NextResponse.json({ error: "Kode gratis hanya bisa dipakai 1x per akun." }, { status: 409 });
    }
    if (request.error) throw new Error("Could not save checkout.");

    const payment = await createMayarCheckout({ amount, email: user.email, redirectUrl: returnUrl.toString() });
    const saved = await client.from("mayar_payment_requests").update({
      mayar_id: payment.id, transaction_id: payment.transactionId,
    }).eq("order_id", orderId).select("order_id").single();
    if (saved.error || !saved.data) throw new Error("Could not save Mayar checkout reference.");

    if (discountCode && discountLabel) await consumeDiscount(discountCode);
    return NextResponse.json({ link: payment.link, transactionId: orderId, amount, discount: discountLabel });
  } catch (error) {
    await client.from("mayar_payment_requests").delete().eq("order_id", orderId).is("mayar_id", null);
    console.error("[payments] Mayar checkout failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Checkout Mayar gagal disiapkan. Silakan coba lagi." }, { status: 502 });
  }
}
