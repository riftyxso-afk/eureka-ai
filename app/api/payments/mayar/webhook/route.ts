import { confirmMayarCheckout, isPaymentId } from "@/lib/mayar";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";
import { db } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  if ((payload?.event ?? payload?.["event.received"]) !== "payment.received") return Response.json({ ok: true });

  const ids = [...new Set([payload.data?.id, payload.data?.transactionId, payload.data?.productId, payload.data?.paymentLinkId].filter(isPaymentId))];
  if (!ids.length) return Response.json({ ok: true });
  try {
    const { data, error } = await db().from("mayar_payment_requests")
      .select("order_id, mayar_id, amount, status")
      .or(`mayar_id.in.(${ids.join(",")}),transaction_id.in.(${ids.join(",")})`);
    if (error) throw error;
    if (!data?.length) return Response.json({ ok: true });
    ensureRateLimitPrune();
    for (const order of data) {
      if (order.status === "paid") continue;
      if (!checkRateLimit(`mayar-hook:${order.order_id}`, 6, 60_000).ok) {
        return Response.json({ ok: false }, { status: 429 });
      }
      // The notification is a lookup hint. Only Mayar's authenticated API can settle the order.
      if (await confirmMayarCheckout(order) === "pending") return Response.json({ ok: false }, { status: 503 });
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 502 });
  }
}
