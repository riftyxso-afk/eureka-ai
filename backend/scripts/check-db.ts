/**
 * Cek read-only: apakah tabel Pakasir (pakasir_payment_requests,
 * pakasir_notification_events) sudah ada di Supabase, dan kolom pakasir_*
 * di public.users.
 * Jalankan dari backend/: npx tsx scripts/check-db.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!url || !key) {
  console.error("Supabase belum dikonfigurasi di backend/.env.local");
  process.exit(1);
}

async function tableExists(table: string): Promise<boolean> {
  const res = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  if (res.status === 200) return true;
  const text = await res.text();
  if (res.status === 404 || text.includes("42P01")) return false;
  // 401/403 → kredensial salah / RLS
  console.error(`  [${table}] HTTP ${res.status}: ${text.slice(0, 200)}`);
  return false;
}

console.log("Cek tabel Pakasir di Supabase (read-only)...");
for (const t of ["pakasir_payment_requests", "pakasir_notification_events"]) {
  console.log(`  ${t}: ${(await tableExists(t)) ? "✅ ADA" : "❌ BELUM ADA (jalankan supabase_patch_010)"}`);
}

// Cek kolom pakasir_* di users
try {
  const res = await fetch(`${url}/rest/v1/users?select=pakasir_invoice_number&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (res.status === 200) {
    console.log("  users.pakasir_invoice_number: ✅ ADA");
  } else {
    const text = await res.text();
    console.log(
      `  users.pakasir_invoice_number: ❌ ${text.includes("42P01") ? "kolom belum ada (jalankan patch 010)" : `HTTP ${res.status}: ${text.slice(0, 120)}`}`
    );
  }
} catch (e) {
  console.error("  users check error:", (e as Error).message);
}

// Cek kolom referral di users (patch 011)
try {
  const res = await fetch(
    `${url}/rest/v1/users?select=referral_code,referred_by,referral_rewarded&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (res.status === 200) {
    console.log("  users.referral_code: ✅ ADA");
    console.log("  users.referred_by: ✅ ADA");
    console.log("  users.referral_rewarded: ✅ ADA");
  } else {
    const text = await res.text();
    console.log(
      `  users.referral_*: ❌ ${text.includes("42P01") ? "kolom belum ada (jalankan supabase_patch_011_referral.sql)" : `HTTP ${res.status}: ${text.slice(0, 120)}`}`
    );
  }
} catch (e) {
  console.error("  users referral check error:", (e as Error).message);
}
