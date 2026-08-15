import { NextRequest, NextResponse } from "next/server";

import {
  buildPayUrl,
  generateInvoiceNumber,
  isPakasirConfigured,
} from "@/lib/pakasir";
import { applyDiscount, consumeDiscount } from "@/lib/discount";
import { authorizeAssistantUser } from "@/lib/assistant/auth";
import { db } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Harga tier dalam Rupiah. */
export const TIER_PRICES: Record<"promo" | "normal", number> = {
  promo: 5000,
  normal: 59000,
};

/**
 * POST /api/payments/checkout
 * Body: { userId: string, tier: "promo" | "normal", discountCode?: string }
 * Membuat transaksi Pakasir (hosted payment page) dan mengembalikan { link }.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      userId?: unknown;
      tier?: unknown;
      discountCode?: unknown;
    } | null;

    const rawUserId = String(body?.userId ?? "").trim();
    const tier = String(body?.tier ?? "").trim() as "promo" | "normal";
    const discountCode = String(body?.discountCode ?? "").trim();

    // Validasi tier.
    if (tier !== "promo" && tier !== "normal") {
      return NextResponse.json(
        { error: "Pilih tier yang valid (promo atau normal)." },
        { status: 400 }
      );
    }

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

    if (!isPakasirConfigured()) {
      return NextResponse.json(
        { error: "Pakasir belum dikonfigurasi di server." },
        { status: 503 }
      );
    }

    // Ambil nama & email user dari DB (dipakai fallback data customer).
    const { data: user, error: userErr } = await db()
      .from("users")
      .select("name, email")
      .eq("id", auth.userId)
      .maybeSingle();
    if (userErr || !user) {
      return NextResponse.json(
        { error: "Data user tidak ditemukan." },
        { status: 404 }
      );
    }

    // Redirect netral: Pakasir hanya mengarahkan kembali setelah bayar sukses;
    // popup sukses diverifikasi server (GET /api/payments/status) — URL tidak
    // boleh mengklaim hasil pembayaran.
    const redirectUrl =
      process.env.PAKASIR_REDIRECT_URL?.trim() ||
      `${req.nextUrl.origin}/dashboard?upgrade=done`;

    const baseAmount = TIER_PRICES[tier];

    // Diskon: hitung harga final bila kode diberikan (opsional).
    let amount = baseAmount;
    let discountLabel: string | null = null;
    if (discountCode) {
      const disc = await applyDiscount(discountCode, baseAmount);
      if (!disc.ok) {
        return NextResponse.json({ error: disc.error }, { status: 400 });
      }
      amount = disc.finalAmount;
      discountLabel = disc.label;
    }

    const orderId = generateInvoiceNumber();

    // Catat permintaan pembayaran (order_id → user + tier + amount) SEBELUM
    // membangun URL, agar webhook Pakasir selalu bisa mencocokkan order &
    // menentukan tier (termasuk saat harga sudah dipotong diskon).
    const { error: reqErr } = await db().from("pakasir_payment_requests").insert({
      user_id: auth.userId,
      order_id: orderId,
      amount,
      tier,
      status: "pending",
    });
    if (reqErr) {
      console.error(
        "[api/payments/checkout] simpan payment request gagal:",
        reqErr
      );
      return NextResponse.json(
        { error: "Gagal menyiapkan pembayaran, coba lagi." },
        { status: 502 }
      );
    }

    const link = buildPayUrl({ amount, orderId, redirectUrl });

    // Checkout berhasil dibuat → catat pemakaian kode diskon (atomik).
    if (discountCode && discountLabel) {
      await consumeDiscount(discountCode);
    }

    return NextResponse.json({
      link,
      transactionId: orderId,
      amount,
      discount: discountLabel,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal membuat pembayaran.";
    console.error("[api/payments/checkout] POST", e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
