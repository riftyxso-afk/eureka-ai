/**
 * Simulasi pembayaran Pakasir "completed" untuk satu email (uji lokal).
 * Alur (persis alur produksi):
 *   1. Catat pakasir_payment_requests (order_id → user + tier + amount)
 *   2. Panggil Pakasir paymentsimulation (sandbox) → order jadi completed
 *   3. Kirim webhook Pakasir ke backend yang berjalan (localhost:3001) →
 *      route memverifikasi via transactiondetail → premium aktif 30 hari
 *
 * Membutuhkan PAKASIR_PROJECT & PAKASIR_API_KEY (proyek sandbox) di
 * backend/.env.local — verifikasi transactiondetail tidak bisa dilewati.
 *
 * Pemakaian:  npx tsx scripts/simulate-payment.ts <email> [tier]
 *   tier: promo (Rp 5.000) | normal (Rp 59.000) — default normal
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const email = process.argv[2]?.trim().toLowerCase();
const tier = (process.argv[3]?.trim() || "normal") as "promo" | "normal";
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Pemakaian: npx tsx scripts/simulate-payment.ts <email> [promo|normal]");
  process.exit(1);
}

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const PROJECT = process.env.PAKASIR_PROJECT?.trim() ?? "";
const API_KEY = process.env.PAKASIR_API_KEY?.trim() ?? "";
const BASE = "http://localhost:3001";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("env Supabase belum lengkap di backend/.env.local");
  process.exit(1);
}
if (!PROJECT || !API_KEY) {
  console.error(
    "❌ PAKASIR_PROJECT / PAKASIR_API_KEY belum di-set di backend/.env.local.\n" +
      "   Aktivasi butuh verifikasi transactiondetail Pakasir (fail-closed) — tidak bisa dilewati."
  );
  process.exit(1);
}

// Cek user ada
const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?select=id,email&email=eq.${encodeURIComponent(email)}`, {
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
});
const users = (await userRes.json()) as { id: string; email: string }[];
if (!users[0]?.id) {
  console.error(`❌ User dengan email ${email} tidak ditemukan.`);
  process.exit(1);
}
const userId = users[0].id;

// 1. Catat payment request (agar order cocok & tier benar)
const ts = Date.now();
const orderId = `EKASIM${ts}`;
const amount = tier === "promo" ? 5000 : 59000;
await fetch(`${SUPABASE_URL}/rest/v1/pakasir_payment_requests`, {
  method: "POST",
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ user_id: userId, order_id: orderId, amount, tier, status: "pending" }),
});

// 2. Buat order + simulasikan pembayaran (sandbox) → completed
const createBody = { project: PROJECT, order_id: orderId, amount, api_key: API_KEY };
await fetch("https://app.pakasir.com/api/transactioncreate/qris", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(createBody),
});
const simRes = await fetch("https://app.pakasir.com/api/paymentsimulation", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(createBody),
});
console.log(`paymentsimulation → HTTP ${simRes.status}`);
if (!simRes.ok) {
  console.error("❌ paymentsimulation gagal — pastikan proyek Pakasir dalam mode sandbox.");
  process.exit(1);
}

// 3. Kirim webhook ke backend yang berjalan
const rawBody = JSON.stringify({
  amount,
  order_id: orderId,
  project: PROJECT,
  status: "completed",
  payment_method: "qris",
  completed_at: new Date().toISOString(),
});
const res = await fetch(`${BASE}/api/payments/webhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: rawBody,
});
const body = (await res.json().catch(() => null)) as { activated?: boolean; duplicate?: boolean; error?: string } | null;
console.log(`Webhook → HTTP ${res.status}: ${JSON.stringify(body)}`);

// Verifikasi DB
const chk = await fetch(`${SUPABASE_URL}/rest/v1/users?select=is_premium,premium_tier,premium_until,pakasir_invoice_number&id=eq.${userId}`, {
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
});
const row = (await chk.json()) as {
  is_premium: boolean;
  premium_tier: string;
  premium_until: string;
  pakasir_invoice_number: string;
}[];
console.log(`DB user: ${JSON.stringify(row[0] ?? null)}`);
console.log(row[0]?.is_premium ? "🎉 Premium AKTIF ✅" : "❌ Premium belum aktif");
