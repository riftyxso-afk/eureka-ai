import { redirect } from "next/navigation";
import { isPaymentId } from "@/lib/paymentIds";

export default async function MayarReturn({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  redirect(isPaymentId(order) ? `/dashboard-v2?upgrade=mayar&order=${order}` : "/dashboard-v2/pricing");
}
