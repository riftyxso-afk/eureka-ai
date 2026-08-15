import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

const project = process.env.PAKASIR_PROJECT?.trim() ?? "";
const apiKey = process.env.PAKASIR_API_KEY?.trim() ?? "";
const orderId = process.argv[2]?.trim() ?? "";

if (!orderId || !project || !apiKey) {
  console.error("Pemakaian: npx tsx scripts/reconcile-order.ts <order_id>");
  process.exit(1);
}

// 1. Ambil baris payment request (user, tier, amount) dari DB.
const { data: req, error: reqErr } = await sb
  .from("pakasir_payment_requests")
  .select("user_id, order_id, amount, tier, status")
  .eq("order_id", orderId)
  .maybeSingle();
if (reqErr || !req) {
  console.error("Request tidak ditemukan di pakasir_payment_requests:", reqErr?.message ?? orderId);
  process.exit(1);
}
if (req.status === "paid") {
  console.log("Request sudah paid — tidak ada yang perlu dilakukan.");
  process.exit(0);
}
console.log("Request:", JSON.stringify(req));

// 2. Verifikasi authoritative via Pakasir transactiondetail.
const params = new URLSearchParams({
  project,
  amount: String(req.amount),
  order_id: orderId,
  api_key: apiKey,
});
const res = await fetch(
  `https://app.pakasir.com/api/transactiondetail?${params.toString()}`,
  { signal: AbortSignal.timeout(15000) }
);
const detail = (await res.json().catch(() => null)) as {
  transaction?: { status?: string; order_id?: string; amount?: number };
} | null;
const txStatus = detail?.transaction?.status ?? "unknown";
console.log(`transactiondetail HTTP ${res.status} → status=${txStatus}`);
if (txStatus !== "completed") {
  console.error("Order belum completed di Pakasir — batalkan rekonsiliasi.");
  process.exit(1);
}

// 3. Aktivasi premium 30 hari (aditif, tier dari baris request).
const { data: user } = await sb
  .from("users")
  .select("id, is_premium, premium_until, premium_tier")
  .eq("id", req.user_id)
  .maybeSingle();
if (!user) {
  console.error("User tidak ditemukan:", req.user_id);
  process.exit(1);
}
console.log("Sebelum:", JSON.stringify(user));

const now = Date.now();
const existing = user.premium_until ? new Date(user.premium_until).getTime() : 0;
const base = existing > now ? existing : now;
const premiumUntil = new Date(base + 30 * 24 * 60 * 60 * 1000).toISOString();

const { error: updErr } = await sb
  .from("users")
  .update({
    is_premium: true,
    premium_tier: req.tier,
    premium_until: premiumUntil,
    pakasir_invoice_number: orderId,
  })
  .eq("id", req.user_id);
if (updErr) {
  console.error("Update users gagal:", updErr.message);
  process.exit(1);
}

// 4. Tandai request lunas + audit event webhook bila ada.
await sb
  .from("pakasir_payment_requests")
  .update({ status: "paid", paid_at: new Date().toISOString() })
  .eq("order_id", orderId);
await sb
  .from("pakasir_notification_events")
  .update({ matched_user_id: req.user_id })
  .eq("order_id", orderId);

const { data: after } = await sb
  .from("users")
  .select("id, is_premium, premium_tier, premium_until, pakasir_invoice_number")
  .eq("id", req.user_id)
  .maybeSingle();
console.log("Sesudah:", JSON.stringify(after));
console.log(after?.is_premium ? "PREMIUM AKTIF" : "MASIH FREE");
