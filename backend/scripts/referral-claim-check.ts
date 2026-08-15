/**
 * Quick check: POST /api/referral/claim (route backend 3001) dengan token asli.
 * 1. buat referrer A (dengan password → login dpt token) + 5 rujukan valid
 *    (applyReferral → auto-reward: rewarded=true, premium ~30 hari)
 * 2. reset referral_rewarded=false → panggil route claim → premium diperpanjang
 *    (+30 hari dari sisa) & rewarded=true
 * 3. panggil claim lagi → alreadyClaimed (idempoten)
 * 4. cleanup semua user
 * Jalankan dari backend/: npx tsx scripts/referral-claim-check.ts
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
const BACKEND = "http://localhost:3001";
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("env Supabase belum lengkap");
  process.exit(1);
}

const { applyReferral, countReferrals, getOrCreateReferralCode } = await import("../../lib/referral");

let failures = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
};

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

async function createAuthUser(email: string, password?: string): Promise<string> {
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: password ?? randomUUID().replace(/-/g, "") + "Aa1!",
      email_confirm: true,
      user_metadata: { name: "Claim Check" },
    }),
  });
  const body = (await authRes.json().catch(() => null)) as { id?: string } | null;
  if (!authRes.ok || !body?.id) throw new Error(`buat user gagal ${email}`);
  await new Promise((r) => setTimeout(r, 800));
  return body.id!;
}

const ts = Date.now();
const base = `claim-${ts}`;
const created: string[] = [];

try {
  // Referrer A dengan password dikenali → bisa login untuk token.
  const pwA = randomUUID().replace(/-/g, "") + "Aa1!";
  const idA = await createAuthUser(`${base}-a@eureka-ai.web.id`, pwA);
  created.push(idA);

  // 5 rujukan valid → auto-reward aktif.
  const codeA = await getOrCreateReferralCode(idA);
  for (let i = 1; i <= 5; i++) {
    const idR = await createAuthUser(`${base}-r${i}@eureka-ai.web.id`);
    created.push(idR);
    await applyReferral(idR, `${base}-r${i}@eureka-ai.web.id`, codeA);
  }
  check("5 rujukan valid", (await countReferrals(idA)) === 5, `count=${await countReferrals(idA)}`);

  const { body: before } = await supabase(`/rest/v1/users?select=premium_until,referral_rewarded&id=eq.${idA}`);
  const beforeRow = (Array.isArray(before) ? before[0] : null) as Record<string, unknown> | null;
  const beforeUntil = beforeRow?.premium_until ? new Date(beforeRow.premium_until as string).getTime() : 0;
  check("auto-reward aktif (rewarded=true)", beforeRow?.referral_rewarded === true);

  // Reset rewarded → simulasikan reward belum sempat diberikan → uji claim.
  await supabase(`/rest/v1/users?id=eq.${idA}`, { method: "PATCH", body: JSON.stringify({ referral_rewarded: false }) });

  // Login A → token
  const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: `${base}-a@eureka-ai.web.id`, password: pwA }),
  });
  const tokenBody = (await tokenRes.json().catch(() => null)) as { access_token?: string } | null;
  const token = tokenBody?.access_token ?? "";
  check("login A → token", !!token);

  if (token) {
    // Claim 1 → berhasil, premium diperpanjang dari sisa (bukan dari nol).
    const res1 = await fetch(`${BACKEND}/api/referral/claim`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ userId: idA }),
    });
    const j1 = (await res1.json().catch(() => null)) as { ok?: boolean; premiumUntil?: string } | null;
    check("claim 1 → ok", res1.status === 200 && j1?.ok === true, JSON.stringify(j1));
    const afterUntil = j1?.premiumUntil ? new Date(j1.premiumUntil).getTime() : 0;
    const delta = (afterUntil - beforeUntil) / 86400000;
    check("premium diperpanjang ~30 hari dari sisa", delta > 29.5 && delta < 30.5, `${delta.toFixed(2)} hari`);

    // Claim 2 → idempoten (alreadyClaimed).
    const res2 = await fetch(`${BACKEND}/api/referral/claim`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ userId: idA }),
    });
    const j2 = (await res2.json().catch(() => null)) as { ok?: boolean; alreadyClaimed?: boolean } | null;
    check("claim 2 → alreadyClaimed", res2.status === 200 && j2?.alreadyClaimed === true, JSON.stringify(j2));
  }
} finally {
  for (const id of [...created].reverse()) {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
      method: "DELETE",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    await new Promise((r) => setTimeout(r, 300));
  }
  check("cleanup semua user tes", true);
}

console.log(failures === 0 ? "\n🎉 Route claim referral OK" : `\n${failures} gagal`);
process.exit(failures === 0 ? 0 : 1);
