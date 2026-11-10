import { requireAuth } from "@/lib/assistant/auth";
import { confirmMayarCheckout, isPaymentId } from "@/lib/mayar";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";
import { db } from "@/lib/supabase/admin";
import { getPremiumStatus } from "@/lib/premium";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireAuth(req.headers.get("authorization"));
  if (!auth.userId) return Response.json({ error: auth.error }, { status: auth.status ?? 401 });
  const body = await req.json().catch(() => null);
  if (!isPaymentId(body?.order)) return Response.json({ error: "ID pembayaran tidak valid." }, { status: 400 });

  ensureRateLimitPrune();
  if (!checkRateLimit(`mayar-confirm:${auth.userId}`, 18, 60_000).ok) {
    return Response.json({ error: "Coba lagi sebentar." }, { status: 429 });
  }
  try {
    const { data, error } = await db().from("mayar_payment_requests")
      .select("order_id, mayar_id, amount, status").eq("order_id", body.order).eq("user_id", auth.userId).maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ error: "Pembayaran tidak ditemukan." }, { status: 404 });
    const status = await confirmMayarCheckout(data);
    return Response.json({
      status,
      isPremium: status === "paid" && (await getPremiumStatus(auth.userId)).isPremium,
    });
  } catch {
    return Response.json({ error: "Status pembayaran belum bisa dikonfirmasi." }, { status: 502 });
  }
}
