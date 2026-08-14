import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/webhook — callback dari Mayar (JSON, POST).
 *
 * Payload (docs.mayar.id/integration/webhook):
 *   { "event": { "received": "payment.received" | "membership.*" },
 *     "data": {
 *       "id": "...", "transactionId"?: "...", "status": bool,
 *       "merchantId": "...", "customerEmail": "...", "customerName": "...",
 *       "amount": 59000, "productId": "...", "productName": "...", ...
 *     } }
 *
 * Flow:
 *   1. Validasi merchantId == MAYAR_MERCHANT_ID (bila env diisi) → selain itu 401.
 *   2. Idempotensi: UNIQUE transaction_id di mayar_webhook_events →
 *      insert pertama menang, duplikat diabaikan (200).
 *   3. payment.received / membership.newMemberRegistered → aktifkan premium
 *      (cari user by email case-insensitive; premium_until = now + 30 hari).
 *   4. membership.memberExpired / memberUnsubscribed → nonaktifkan premium.
 *   5. Selalu balas 200 (kecuali 401) agar Mayar tidak retry tanpa perlu.
 */
export async function POST(req: NextRequest) {
  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid." }, { status: 400 });
  }

  const body = payload as {
    event?: { received?: string } | string;
    eventType?: string;
    data?: {
      id?: string;
      transactionId?: string;
      transaction_id?: string;
      status?: boolean;
      merchantId?: string;
      merchantEmail?: string;
      customerEmail?: string;
      customerName?: string;
      amount?: number;
      productId?: string;
      productName?: string;
      licenseCode?: string;
      [key: string]: unknown;
    };
  };

  const data = body?.data ?? {};
  const eventRaw =
    (typeof body?.event === "object"
      ? body.event.received
      : body?.event) ??
    body?.eventType ??
    "";
  const eventType = String(eventRaw ?? "").trim();

  // ── 1. Validasi merchantId (FAIL-CLOSED) ─────────────────────
  // Bila MAYAR_MERCHANT_ID belum diisi di env → TOLAK SEMUA webhook
  // (503). Jangan pernah memproses webhook tanpa verifikasi — kalau tidak,
  // attacker bisa kirim `payment.received` palsu dan dapat premium gratis.
  const expectedMerchantId = process.env.MAYAR_MERCHANT_ID?.trim();
  if (!expectedMerchantId) {
    console.error(
      "[webhook] MAYAR_MERCHANT_ID belum di-set — semua webhook ditolak (fail-closed)."
    );
    return NextResponse.json(
      { error: "Server belum dikonfigurasi untuk webhook." },
      { status: 503 }
    );
  }
  const gotMerchantId = String(data.merchantId ?? "").trim();
  if (gotMerchantId !== expectedMerchantId) {
    console.warn(
      `[webhook] merchantId tidak cocok: got=${gotMerchantId} expected=${expectedMerchantId}`
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Idempotensi via transactionId ─────────────────────────
  const transactionId = String(
    data.transactionId ?? data.transaction_id ?? data.id ?? ""
  ).trim();

  const amount = Number(data.amount) || 0;
  const customerEmail = String(data.customerEmail ?? "").trim().toLowerCase();
  const customerName = String(data.customerName ?? "").trim();
  const productId = String(data.productId ?? "").trim();
  const licenseCodeRaw = String(
    (data as Record<string, unknown>).licenseCode ?? ""
  ).trim();

  // Simpan payload audit + klaim slot idempotensi (atomic via UNIQUE).
  const { error: insertErr } = await db()
    .from("mayar_webhook_events")
    .insert({
      event_type: eventType,
      transaction_id: transactionId || null,
      payload: body as Record<string, unknown>,
    });

  if (insertErr) {
    // Duplikat (unique violation) → sudah pernah diproses → 200 tanpa aksi.
    if (String(insertErr.message ?? "").toLowerCase().includes("duplicate")) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error("[webhook] simpan event gagal:", insertErr);
    return NextResponse.json(
      { error: "Gagal menyimpan event." },
      { status: 500 }
    );
  }

  // ── 3 & 4. Proses event ──────────────────────────────────────
  if (
    eventType === "payment.received" ||
    eventType === "membership.newMemberRegistered" ||
    eventType === "membership.changeTierMemberRegistered"
  ) {
    // Event aktifasi dengan status transaksi false → tolak (jangan aktifkan).
    if (data.status === false) {
      console.warn(`[webhook] ${eventType} dengan status=false — diabaikan`);
      return NextResponse.json({ ok: true, skipped: "status false" });
    }
    if (!customerEmail) {
      console.warn("[webhook] event tanpa customerEmail:", eventType);
      return NextResponse.json({ ok: true, skipped: "no email" });
    }

    // Cari user by email (case-insensitive).
    const { data: users, error: findErr } = await db()
      .from("users")
      .select("id, is_premium, premium_tier, premium_until")
      .ilike("email", customerEmail)
      .limit(1);
    if (findErr) {
      console.error("[webhook] cari user gagal:", findErr);
      return NextResponse.json({ ok: true, matched: false });
    }

    const user = users?.[0];
    if (!user) {
      // Email belum terdaftar → catat saja (audit), balas 200.
      console.warn(
        `[webhook] email ${customerEmail} tidak cocok dengan user mana pun (${eventType})`
      );
      return NextResponse.json({ ok: true, matched: false });
    }

    // Validasi transaksi hanya untuk produk kita: cocokkan productId ke env,
    // fallback ke amount yang dikenal. Bila tidak cocok → JANGAN aktifkan.
    const promoProductId = process.env.MAYAR_PRODUCT_ID_PROMO?.trim();
    const normalProductId = process.env.MAYAR_PRODUCT_ID_NORMAL?.trim();
    let tier: "promo" | "normal" | null = null;
    if (productId) {
      if (promoProductId && productId === promoProductId) tier = "promo";
      else if (normalProductId && productId === normalProductId) tier = "normal";
    }
    if (!tier) {
      if (amount === 5000) tier = "promo";
      else if (amount === 59000) tier = "normal";
    }
    if (!tier) {
      // Produk/amount tidak dikenal → kemungkinan produk lain di akun Mayar
      // yang sama. Catat & abaikan (200 agar Mayar tidak retry), JANGAN
      // aktifkan premium.
      console.warn(
        `[webhook] transaksi bukan produk Eureka (event=${eventType} productId=${productId} amount=${amount}) — diabaikan`
      );
      return NextResponse.json({ ok: true, skipped: "unknown product" });
    }

    const now = new Date();
    const premiumUntil = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    const updates: Record<string, unknown> = {
      is_premium: true,
      premium_until: premiumUntil,
    };
    if (tier) updates.premium_tier = tier;
    if (productId) updates.mayar_product_id = productId;
    if (licenseCodeRaw) updates.mayar_license_code = licenseCodeRaw;
    if (data.id) updates.mayar_customer_id = String(data.id);

    const { error: updErr } = await db()
      .from("users")
      .update(updates)
      .eq("id", user.id);
    if (updErr) {
      console.error("[webhook] update premium gagal:", updErr);
      return NextResponse.json({ ok: true, error: "update failed" });
    }

    console.log(
      `[webhook] ${eventType} → premium aktif untuk ${customerEmail} (${tier ?? "?"}, s/d ${premiumUntil})`
    );
    return NextResponse.json({ ok: true, activated: true });
  }

  if (
    eventType === "membership.memberExpired" ||
    eventType === "membership.memberUnsubscribed"
  ) {
    if (customerEmail) {
      const { data: users } = await db()
        .from("users")
        .select("id")
        .ilike("email", customerEmail)
        .limit(1);
      const user = users?.[0];
      if (user) {
        await db()
          .from("users")
          .update({ is_premium: false })
          .eq("id", user.id);
        console.log(`[webhook] ${eventType} → premium nonaktif untuk ${customerEmail}`);
      }
    }
    return NextResponse.json({ ok: true, deactivated: true });
  }

  // Event lain (mis. payment.reminder, shipper.status) → diabaikan, 200.
  return NextResponse.json({ ok: true, ignored: eventType });
}
