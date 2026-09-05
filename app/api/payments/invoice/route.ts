import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/assistant/auth";
import { db } from "@/lib/supabase/admin";
import { buildInvoicePdfBuffer } from "@/lib/invoicePdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/payments/invoice?orderId=EKA...&userId=...
 * Mengembalikan PDF invoice yang rapi untuk 1 order milik user.
 * Query userId wajib cocok dengan token (requireAuth).
 */
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId")?.trim();
  const rawUserId = req.nextUrl.searchParams.get("userId")?.trim() ?? "";

  if (!orderId) {
    return NextResponse.json({ error: "orderId diperlukan" }, { status: 400 });
  }

  const auth = await requireAuth(req.headers.get("authorization"), rawUserId);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });
  }
  const userId = auth.userId;

  try {
    // Ambil order dari pakasir_payment_requests
    const { data: order, error: orderErr } = await db()
      .from("pakasir_payment_requests")
      .select("order_id, amount, tier, status, paid_at, created_at")
      .eq("order_id", orderId)
      .eq("user_id", userId)
      .maybeSingle();

    if (orderErr) throw orderErr;
    if (!order) {
      return NextResponse.json({ error: "Invoice tidak ditemukan" }, { status: 404 });
    }

    // Ambil info user untuk header invoice
    const { data: user } = await db()
      .from("users")
      .select("email, name")
      .eq("id", userId)
      .maybeSingle();

    const pdf = await buildInvoicePdfBuffer({
      orderId: order.order_id,
      amount: Number(order.amount),
      tier: String(order.tier),
      status: String(order.status),
      paidAt: order.paid_at as string | null,
      createdAt: order.created_at as string | null,
      userEmail: (user as { email?: string })?.email ?? null,
      userName: (user as { name?: string })?.name ?? null,
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${orderId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[api/payments/invoice] GET", e);
    return NextResponse.json({ error: "Gagal membuat invoice" }, { status: 500 });
  }
}
