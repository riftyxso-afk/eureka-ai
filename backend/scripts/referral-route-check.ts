/**
 * Quick check: GET /api/referral (route backend 3001) dengan token asli.
 * 1. buat user auth + login → access_token
 * 2. panggil route dengan Bearer token → pastikan 200 + shape status referral
 * 3. cleanup user
 * Jalankan dari backend/: npx tsx scripts/referral-route-check.ts
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
const BACKEND = process.env.PAYMENTS_BACKEND_URL ?? "http://localhost:3001";
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("env Supabase belum lengkap");
  process.exit(1);
}

let failures = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
};

const ts = Date.now();
const email = `ref-route-${ts}@eureka-ai.web.id`;
const password = randomUUID().replace(/-/g, "") + "Aa1!";

// 1. buat user + ambil token
const created = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: "POST",
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name: "Ref Route Check" } }),
}).then((r) => r.json() as Promise<{ id?: string }>);
const userId = created?.id ?? "";
check("buat user auth", !!userId, email);

const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: SERVICE_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const tokenBody = (await tokenRes.json().catch(() => null)) as { access_token?: string } | null;
const token = tokenBody?.access_token ?? "";
check("login → access_token", !!token);

if (userId && token) {
  // 2. panggil route
  const res = await fetch(`${BACKEND}/api/referral?userId=${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json().catch(() => null)) as {
    code?: string; count?: number; goal?: number; rewarded?: boolean; link?: string;
  } | null;
  check("route 200", res.status === 200, `HTTP ${res.status}`);
  check(
    "shape status referral",
    typeof body?.code === "string" && body.code.length >= 6 &&
      typeof body?.count === "number" && body?.goal === 5 &&
      body?.rewarded === false && typeof body?.link === "string" && body.link.includes("ref="),
    JSON.stringify(body)
  );
  check("link memuat userId origin", body?.link?.includes("ref=") === true);
}

// 3. cleanup
if (userId) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  check("cleanup user tes", true);
}

console.log(failures === 0 ? "\n🎉 Route referral OK" : `\n${failures} gagal`);
process.exit(failures === 0 ? 0 : 1);
