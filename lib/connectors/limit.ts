import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";
export function connectorLimit(user: string) {
  ensureRateLimitPrune();
  const result = checkRateLimit("connector-connect:" + user, 20, 600000);
  return result.ok ? null : Response.json({ error: "Terlalu banyak percobaan koneksi. Coba beberapa saat lagi." },
    { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)), "Cache-Control": "no-store" } });
}
