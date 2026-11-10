import { db } from "@/lib/supabase/admin";
import { isPaymentId } from "@/lib/paymentIds";
export { isPaymentId } from "@/lib/paymentIds";

export function isMayarConfigured(): boolean {
  const key = process.env.MAYAR_API_KEY?.trim();
  return Boolean(key && !key.startsWith("your-"));
}

interface MayarPayment {
  id?: string;
  transactionId?: string;
  link?: string;
  redirectUrl?: string;
  status?: string;
  amount?: number;
}

async function mayarRequest(path: string, body?: object): Promise<MayarPayment> {
  if (!isMayarConfigured()) throw new Error("Mayar is unavailable.");
  const origin = process.env.MAYAR_SANDBOX === "true" ? "https://api.mayar.io" : "https://api.mayar.id";
  const response = await fetch(`${origin}/hl/v2/payments${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${process.env.MAYAR_API_KEY?.trim()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json().catch(() => null) as { data?: MayarPayment } | null;
  if (!response.ok || !payload?.data) throw new Error(`Mayar request failed (${response.status}).`);
  return payload.data;
}

export async function createMayarCheckout(input: { amount: number; email: string; redirectUrl: string }) {
  const payment = await mayarRequest("/create", {
    ...input,
    name: "Eureka Pro",
    description: "Akses Eureka Pro selama 30 hari",
    expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
  const url = new URL(payment.link ?? "");
  if (!isPaymentId(payment.id) || !isPaymentId(payment.transactionId) ||
    payment.redirectUrl !== input.redirectUrl || url.protocol !== "https:" ||
    url.username || url.password ||
    !["myr.id", "mayar.id", "mayar.io"].some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) {
    throw new Error("Mayar did not return a valid checkout with a saved return URL.");
  }
  return { id: payment.id, transactionId: payment.transactionId, link: url.toString() };
}

export type MayarOrder = {
  order_id: string;
  mayar_id: string | null;
  amount: number;
  status: "pending" | "paid";
};

export async function confirmMayarCheckout(order: MayarOrder): Promise<"pending" | "paid" | "closed"> {
  if (order.status === "paid") return "paid";
  if (!order.mayar_id) return "pending";
  const payment = await mayarRequest(`/${encodeURIComponent(order.mayar_id)}`);
  if (payment.id !== order.mayar_id || payment.amount !== order.amount) {
    throw new Error("Mayar checkout does not match the stored order.");
  }
  if (payment.status !== "paid") return payment.status === "closed" || payment.status === "expired" ? "closed" : "pending";

  const { data, error } = await db().rpc("settle_mayar_checkout", {
    p_order_id: order.order_id, p_mayar_id: order.mayar_id, p_amount: order.amount,
  });
  if (error || data !== true) throw new Error("Could not settle Mayar checkout.");
  return "paid";
}
