/**
 * E2E webhook Pakasir → Supabase.
 * Menguji route asli POST /api/payments/webhook dengan user tes sintetis:
 *   1. project tidak cocok → 401
 *   2. status pending → 200 tanpa aktivasi
 *   3. status completed + order tidak tercatat → 200 matched:false
 *   4. amount tidak cocok → 200 skipped
 *   5. duplikat (order_id sama) → 200 duplicate
 *   6. Aktivasi penuh (completed → premium 30 hari): HANYA bila
 *      PAKASIR_PROJECT/PAKASIR_API_KEY terisi (sandbox) — order dibuat via
 *      transactioncreate + paymentsimulation agar transactiondetail completed.
 * Bersih-bersih: user tes + semua baris tes dihapus di akhir.
 *
 * Jalankan dari backend/:  npx tsx scripts/webhook-e2e.ts
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextRequest } from "next/server";

// ── env dari backend/.env.local ──
const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
let PROJECT = process.env.PAKASIR_PROJECT?.trim() ?? "";
let API_KEY = process.env.PAKASIR_API_KEY?.trim() ?? "";
// Tanpa kredensial asli, set placeholder agar route melewati gate config
// (fail-closed) dan cabang yang TIDAK memanggil transactiondetail bisa diuji.
const HAS_REAL_CREDS = PROJECT.length > 0 && API_KEY.length > 0;
if (!HAS_REAL_CREDS) {
  PROJECT = "e2e-test-project";
  API_KEY = "e2e-test-api-key";
  process.env.PAKASIR_PROJECT = PROJECT;
  process.env.PAKASIR_API_KEY = API_KEY;
}
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("env Supabase belum lengkap di backend/.env.local");
  process.exit(1);
}

const { POST } = await import("../../app/api/payments/webhook/route");

let failures = 0;
function check(name: string, ok: boolean, extra = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
}

async function supabase(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body };
}

// ── Setup: user tes + payment request ──────────────────────
const ts = Date.now();
const email = `pakasir-sandbox-${ts}@eureka-ai.web.id`;
const orderPending = `EKATESTP${ts}`;
const orderUnknown = `EKANONE${ts}`;
const orderMismatch = `EKAMIS${ts}`;
const orderDup = `EKADUP${ts}`;

const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: "POST",
  headers: {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email,
    password: randomUUID().replace(/-/g, "") + "Aa1!",
    email_confirm: true,
    user_metadata: { name: "Test Pakasir Sandbox" },
  }),
});
const authBody = (await authRes.json().catch(() => null)) as { id?: string } | null;
const userId = authBody?.id ?? "";
if (authRes.ok && userId) {
  check("buat user auth tes", true, email);
} else {
  console.error("Gagal buat user auth:", authRes.status, JSON.stringify(authBody).slice(0, 300));
  process.exit(1);
}
await new Promise((r) => setTimeout(r, 800));

await supabase("/rest/v1/pakasir_payment_requests", {
  method: "POST",
  body: JSON.stringify({
    user_id: userId,
    order_id: orderPending,
    amount: 59000,
    tier: "normal",
    status: "pending",
  }),
});
await supabase("/rest/v1/pakasir_payment_requests", {
  method: "POST",
  body: JSON.stringify({
    user_id: userId,
    order_id: orderMismatch,
    amount: 59000,
    tier: "normal",
    status: "pending",
  }),
});
await supabase("/rest/v1/pakasir_payment_requests", {
  method: "POST",
  body: JSON.stringify({
    user_id: userId,
    order_id: orderDup,
    amount: 5000,
    tier: "promo",
    status: "pending",
  }),
});

function notif(orderId: string, status: string, amount: number, project = PROJECT) {
  return {
    amount,
    order_id: orderId,
    project,
    status,
    payment_method: "qris",
    completed_at: new Date().toISOString(),
  };
}
async function callWebhook(body: object) {
  const req = new NextRequest("http://localhost:3001/api/payments/webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req);
}

// ── 1. project tidak cocok → 401 ───────────────────────────
let res = await callWebhook(notif(orderPending, "completed", 59000, "proyek-salah"));
check("1. project tidak cocok → 401", res.status === 401, `HTTP ${res.status}`);

// ── 2. status pending → 200 tanpa aktivasi ─────────────────
res = await callWebhook(notif(orderPending, "pending", 59000));
const j2 = (await res.json()) as { skipped?: string };
check("2. pending → 200 skipped", res.status === 200 && j2.skipped === "pending", JSON.stringify(j2));

// ── 3. completed + order tidak tercatat → matched:false ────
res = await callWebhook(notif(orderUnknown, "completed", 5000));
const j3 = (await res.json()) as { matched?: boolean };
check("3. order tak dikenal → matched:false", res.status === 200 && j3.matched === false, JSON.stringify(j3));

// ── 4. amount tidak cocok → 200 skipped ────────────────────
res = await callWebhook(notif(orderMismatch, "completed", 1111));
const j4 = (await res.json()) as { skipped?: string };
check("4. amount tidak cocok → skipped", res.status === 200 && j4.skipped === "amount mismatch", JSON.stringify(j4));

// ── 5. duplikat (order_id sama, status pending) → duplicate ─
res = await callWebhook(notif(orderDup, "pending", 5000)); // pertama → 200 skipped
const j5a = (await res.json()) as { skipped?: string };
res = await callWebhook(notif(orderDup, "pending", 5000)); // kedua → duplicate
const j5 = (await res.json()) as { duplicate?: boolean };
check("5a. pertama → 200 skipped", res.status === 200 && j5a.skipped === "pending", JSON.stringify(j5a));
check("5b. duplikat → 200 duplicate:true", res.status === 200 && j5.duplicate === true, JSON.stringify(j5));

// ── 6. Aktivasi penuh (butuh sandbox Pakasir) ──────────────
if (HAS_REAL_CREDS) {
  console.log(`\n[6] Kredensial Pakasir ada — uji aktivasi penuh (sandbox)...`);
  const orderId = `EKAFULL${ts}`;
  await supabase("/rest/v1/pakasir_payment_requests", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, order_id: orderId, amount: 5000, tier: "promo", status: "pending" }),
  });

  // Buat order nyata + simulasi pembayaran agar transactiondetail = completed
  const createBody = { project: PROJECT, order_id: orderId, amount: 5000, api_key: API_KEY };
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
  check("6a. paymentsimulation → 200", simRes.status === 200, `HTTP ${simRes.status}`);

  res = await callWebhook(notif(orderId, "completed", 5000));
  const j6 = (await res.json()) as { activated?: boolean };
  check("6b. webhook completed → activated", res.status === 200 && j6.activated === true, JSON.stringify(j6));

  const { body: userAfter } = await supabase(
    `/rest/v1/users?select=is_premium,premium_tier,premium_until,pakasir_invoice_number&id=eq.${userId}`
  );
  const u = (Array.isArray(userAfter) ? userAfter[0] : null) as Record<string, unknown> | null;
  check("6c. users.is_premium=true", u?.is_premium === true, JSON.stringify(u));
  check("6d. tier=promo", u?.premium_tier === "promo");
  check("6e. pakasir_invoice_number tersimpan", u?.pakasir_invoice_number === orderId);
  const until = u?.premium_until ? new Date(u.premium_until as string).getTime() : 0;
  const deltaDays = (until - Date.now()) / 86400000;
  check("6f. premium_until ≈ 30 hari", deltaDays > 29.8 && deltaDays < 30.2, `${deltaDays.toFixed(2)} hari`);

  const { body: pr } = await supabase(
    `/rest/v1/pakasir_payment_requests?select=status,paid_at&order_id=eq.${orderId}`
  );
  const prRow = (Array.isArray(pr) ? pr[0] : null) as Record<string, unknown> | null;
  check("6g. payment request status=paid", prRow?.status === "paid");
} else {
  console.log("\n⚠️  PAKASIR_PROJECT / PAKASIR_API_KEY belum di-set — uji aktivasi penuh dilewati (butuh sandbox).");
}

// ── Bersih-bersih ───────────────────────────────────────────
await supabase(`/rest/v1/pakasir_notification_events?order_id=like.EKA%25${ts}%25`, {
  method: "DELETE",
});
await supabase(`/rest/v1/pakasir_payment_requests?order_id=like.EKA%25${ts}%25`, {
  method: "DELETE",
});
const delRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
  method: "DELETE",
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
});
await new Promise((r) => setTimeout(r, 500));
const { body: gone } = await supabase(`/rest/v1/users?select=id&id=eq.${userId}`);
check("cleanup user tes terhapus", delRes.ok && !(Array.isArray(gone) && gone.length > 0));

console.log(failures === 0 ? "\n🎉 Semua tes webhook lulus" : `\n${failures} tes gagal`);
process.exit(failures === 0 ? 0 : 1);
