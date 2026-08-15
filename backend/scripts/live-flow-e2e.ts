/**
 * E2E alur pembayaran Pakasir lewat SERVER LIVE (http://localhost:3001) —
 * menguji env & proses yang sama dengan browser.
 *
 * Alur (butuh PAKASIR_PROJECT/PAKASIR_API_KEY sandbox di backend/.env.local
 * ATAU di root .env.local yang dibaca server):
 *   A. checkout (normal) → link pay Pakasir → paymentsimulation → webhook
 *      completed → status premium ≈ 30 hari
 *   B. cancel → status non-premium
 *   C. checkout (promo) → webhook status "pending" → status tetap non-premium
 *      (persis kondisi yang bikin popup menampilkan toast netral, bukan sukses)
 *
 * User tes & baris DB dihapus di akhir.
 * Jalankan dari backend/:  npx tsx scripts/live-flow-e2e.ts
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const PROJECT = process.env.PAKASIR_PROJECT?.trim() ?? "";
const API_KEY = process.env.PAKASIR_API_KEY?.trim() ?? "";
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("env Supabase belum lengkap di backend/.env.local");
  process.exit(1);
}

const BASE = "http://localhost:3001";
let failures = 0;
function check(name: string, ok: boolean, extra = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
}

// ── Setup: user tes + sign in ───────────────────────────────
const ts = Date.now();
const email = `live-flow-${ts}@eureka-ai.web.id`;
const password = randomUUID().replace(/-/g, "") + "Aa1!";

const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: "POST",
  headers: {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name: "Live Flow Pakasir" } }),
});
const authBody = (await authRes.json().catch(() => null)) as { id?: string } | null;
const userId = authBody?.id ?? "";
if (!authRes.ok || !userId) {
  console.error("❌ gagal buat user:", authRes.status, JSON.stringify(authBody).slice(0, 300));
  process.exit(1);
}
console.log("✅ user tes dibuat:", email);
await new Promise((r) => setTimeout(r, 800));

const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: SERVICE_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const tokenBody = (await tokenRes.json().catch(() => null)) as { access_token?: string } | null;
const token = tokenBody?.access_token ?? "";
if (!tokenRes.ok || !token) {
  console.error("❌ gagal sign in");
  process.exit(1);
}
console.log("✅ sign in ok\n");

const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
async function api(path: string, init: RequestInit = {}) {
  return fetch(`${BASE}${path}`, { ...init, headers: { ...authHeaders, ...(init.headers ?? {}) } });
}
async function getStatus() {
  const res = await api(`/api/payments/status?userId=${encodeURIComponent(userId)}`);
  const body = (await res.json().catch(() => null)) as { isPremium?: boolean; tier?: string | null } | null;
  return { isPremium: body?.isPremium === true, tier: body?.tier ?? null };
}
async function sendWebhook(orderId: string, status: string, amount: number) {
  return fetch(`${BASE}/api/payments/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount,
      order_id: orderId,
      project: PROJECT,
      status,
      payment_method: "qris",
      completed_at: new Date().toISOString(),
    }),
  });
}

if (!PROJECT || !API_KEY) {
  console.log(
    "⚠️  PAKASIR_PROJECT / PAKASIR_API_KEY belum di-set — hanya uji checkout (bila server sudah dikonfigurasi)."
  );
  const res = await api("/api/payments/checkout", {
    method: "POST",
    body: JSON.stringify({ userId, tier: "normal" }),
  });
  const body = (await res.json().catch(() => null)) as { error?: string; link?: string } | null;
  if (res.status === 200 && body?.link) {
    check("A1. checkout → 200 + link Pakasir", body.link.startsWith("https://app.pakasir.com/pay/"), body.link.slice(0, 70));
  } else {
    check("A1. checkout (server belum PAKASIR_PROJECT → 503)", res.status === 503, `HTTP ${res.status}: ${body?.error}`);
  }
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  console.log(failures === 0 ? "\n🎉 Tes live (tanpa kredensial) lulus" : `\n${failures} tes gagal`);
  process.exit(failures === 0 ? 0 : 1);
}

// ── A. Sukses: checkout → paymentsimulation → webhook → premium ─
console.log("── A. Alur sukses ──");
let res = await api("/api/payments/checkout", { method: "POST", body: JSON.stringify({ userId, tier: "normal" }) });
const coA = (await res.json().catch(() => null)) as { link?: string; transactionId?: string } | null;
check("A1. checkout normal → 200 + link Pakasir", res.status === 200 && !!coA?.link, `HTTP ${res.status}`);
check("A2. link = app.pakasir.com/pay/...", (coA?.link ?? "").startsWith("https://app.pakasir.com/pay/"), (coA?.link ?? "").slice(0, 60));
const orderA = coA?.transactionId ?? "";

// Buat order nyata + simulasi pembayaran agar transactiondetail = completed
const createA = { project: PROJECT, order_id: orderA, amount: 59000, api_key: API_KEY };
await fetch("https://app.pakasir.com/api/transactioncreate/qris", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(createA),
});
const simA = await fetch("https://app.pakasir.com/api/paymentsimulation", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(createA),
});
check("A3. paymentsimulation → 200", simA.status === 200, `HTTP ${simA.status}`);

res = await sendWebhook(orderA, "completed", 59000);
const whA = (await res.json().catch(() => null)) as { activated?: boolean } | null;
check("A4. webhook completed → activated", res.status === 200 && whA?.activated === true, JSON.stringify(whA));

let status = await getStatus();
check("A5. status premium aktif", status.isPremium === true, `tier=${status.tier}`);

// ── B. Cancel → non-premium ─────────────────────────────────
console.log("\n── B. Alur cancel ──");
res = await api("/api/payments/cancel", { method: "POST", body: JSON.stringify({ userId }) });
check("B1. cancel → ok", res.status === 200, `HTTP ${res.status}`);
status = await getStatus();
check("B2. status non-premium setelah cancel", status.isPremium === false, JSON.stringify(status));

// ── C. Gagal: checkout → webhook pending → tetap non-premium ─
console.log("\n── C. Alur gagal/batal (popup toast netral) ──");
res = await api("/api/payments/checkout", { method: "POST", body: JSON.stringify({ userId, tier: "promo" }) });
const coC = (await res.json().catch(() => null)) as { transactionId?: string } | null;
const orderC = coC?.transactionId ?? "";
check("C1. checkout promo → 200", res.status === 200, `HTTP ${res.status}`);

res = await sendWebhook(orderC, "pending", 5000);
check("C2. webhook pending → 200 tanpa aktivasi", res.status === 200, `HTTP ${res.status}`);
status = await getStatus();
check("C3. status tetap non-premium (toast netral, bukan sukses)", status.isPremium === false, JSON.stringify(status));

// ── Bersih-bersih ───────────────────────────────────────────
console.log("\n── Bersih-bersih ──");
await fetch(`${SUPABASE_URL}/rest/v1/pakasir_notification_events?order_id=like.EKA%25${ts}%25`, {
  method: "DELETE",
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
});
await fetch(`${SUPABASE_URL}/rest/v1/pakasir_payment_requests?order_id=like.EKA%25${ts}%25`, {
  method: "DELETE",
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
});
const delRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
  method: "DELETE",
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
});
check("cleanup user tes terhapus", delRes.ok);

console.log(failures === 0 ? "\n🎉 Semua tes alur live lulus" : `\n${failures} tes gagal`);
process.exit(failures === 0 ? 0 : 1);
