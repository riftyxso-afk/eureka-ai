/**
 * E2E fitur Referral → Supabase.
 * Menguji logika asli (lib/referral.ts) dengan user tes sintetis:
 *   1. kode referral unik per user
 *   2. self-referral ditolak (tidak menambah hitungan)
 *   3. email sama dengan pengundang → ditolak
 *   4. kode tidak dikenal → tidak ada atribusi
 *   5. 5 rujukan valid → reward premium 30 hari (sekali pakai)
 *   6. rujukan ke-6+ → tidak ada reward tambahan
 *   7. hitungan hanya pendaftaran valid
 * Bersih-bersih: semua user tes + baris terkait dihapus di akhir.
 *
 * Jalankan dari backend/:  npx tsx scripts/referral-e2e.ts
 * (butuh supabase_patch_011_referral.sql sudah dijalankan di Supabase)
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
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("env Supabase belum lengkap di backend/.env.local");
  process.exit(1);
}

const { getOrCreateReferralCode, applyReferral, countReferrals } =
  await import("../../lib/referral");

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

async function createAuthUser(email: string, name: string): Promise<string> {
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
      user_metadata: { name },
    }),
  });
  const body = (await authRes.json().catch(() => null)) as { id?: string } | null;
  if (!authRes.ok || !body?.id) {
    throw new Error(`gagal buat user ${email}: ${authRes.status} ${JSON.stringify(body).slice(0, 200)}`);
  }
  // Tunggu trigger membuat baris di public.users
  await new Promise((r) => setTimeout(r, 800));
  return body.id!;
}

async function deleteAuthUser(userId: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  await new Promise((r) => setTimeout(r, 500));
  const { body } = await supabase(`/rest/v1/users?select=id&id=eq.${userId}`);
  return res.ok && !(Array.isArray(body) && body.length > 0);
}

const ts = Date.now();
const base = `ref-e2e-${ts}`;
const createdUsers: string[] = [];
const cleanup: Promise<boolean>[] = [];

try {
  // ── 1. Kode referral unik per user ───────────────────────
  const emailA = `${base}-a@eureka-ai.web.id`;
  const idA = await createAuthUser(emailA, "Referral A");
  createdUsers.push(idA);
  const codeA = await getOrCreateReferralCode(idA);
  check("1a. kode referral dibuat", codeA.length >= 6, codeA);
  const codeA2 = await getOrCreateReferralCode(idA);
  check("1b. kode stabil (tidak berubah)", codeA2 === codeA);

  const emailOther = `${base}-other@eureka-ai.web.id`;
  const idOther = await createAuthUser(emailOther, "Referral Other");
  createdUsers.push(idOther);
  const codeOther = await getOrCreateReferralCode(idOther);
  check("1c. dua user punya kode berbeda", codeOther !== codeA);

  // ── 2. Self-referral ditolak ─────────────────────────────
  await applyReferral(idA, emailA, codeA);
  check("2. self-referral tidak menambah hitungan", (await countReferrals(idA)) === 0);

  // ── 3. Email sama dengan pengundang → ditolak ─────────────
  const emailSame = `${base}-same@eureka-ai.web.id`;
  const idSame = await createAuthUser(emailSame, "Referral SameEmail");
  createdUsers.push(idSame);
  await applyReferral(idSame, emailA, codeA); // email param = email A
  check("3. email sama pengundang → tidak dihitung", (await countReferrals(idA)) === 0);

  // ── 4. Kode tidak dikenal → tidak ada atribusi ───────────
  const emailNoRef = `${base}-noref@eureka-ai.web.id`;
  const idNoRef = await createAuthUser(emailNoRef, "Referral NoRef");
  createdUsers.push(idNoRef);
  await applyReferral(idNoRef, emailNoRef, "ZZZZZZZZ");
  check("4. kode tak dikenal → tidak dihitung", (await countReferrals(idA)) === 0);

  // ── 5. Lima rujukan valid → reward premium 30 hari ────────
  let rewarded = false;
  for (let i = 1; i <= 5; i++) {
    const emailR = `${base}-r${i}@eureka-ai.web.id`;
    const idR = await createAuthUser(emailR, `Referral R${i}`);
    createdUsers.push(idR);
    await applyReferral(idR, emailR, codeA);
    if (i === 5) {
      const { body } = await supabase(
        `/rest/v1/users?select=is_premium,premium_tier,premium_until,referral_rewarded,referred_by&id=eq.${idA}`
      );
      const a = (Array.isArray(body) ? body[0] : null) as Record<string, unknown> | null;
      check("5a. hitungan mencapai 5", (await countReferrals(idA)) === 5, `count=${await countReferrals(idA)}`);
      rewarded = a?.referral_rewarded === true;
      check("5b. referral_rewarded = true", rewarded, JSON.stringify(a));
      check("5c. premium aktif (tier normal)", a?.is_premium === true && a?.premium_tier === "normal");
      const until = a?.premium_until ? new Date(a.premium_until as string).getTime() : 0;
      const days = (until - Date.now()) / 86400000;
      check("5d. premium_until ≈ 30 hari", days > 29.8 && days < 30.2, `${days.toFixed(2)} hari`);
    }
  }

  // ── 6. Rujukan ke-6 → tidak ada reward tambahan ──────────
  const emailR6 = `${base}-r6@eureka-ai.web.id`;
  const idR6 = await createAuthUser(emailR6, "Referral R6");
  createdUsers.push(idR6);
  await applyReferral(idR6, emailR6, codeA);
  const { body: after6 } = await supabase(
    `/rest/v1/users?select=is_premium,premium_until,referral_rewarded&id=eq.${idA}`
  );
  const a6 = (Array.isArray(after6) ? after6[0] : null) as Record<string, unknown> | null;
  check("6a. count = 6 (tetap dihitung)", (await countReferrals(idA)) === 6);
  check(
    "6b. tidak ada reward berulang (premium_until tidak bertambah)",
    a6?.referral_rewarded === true && !(await isExtendedMoreThan(a6, 30)),
    `rewarded=${a6?.referral_rewarded}`
  );

  // ── 7. Hitungan hanya pendaftaran valid ──────────────────
  // idSame & idNoRef & self tidak dihitung; idR1..R6 dihitung = 6
  check("7. hanya rujukan valid yang dihitung (6)", (await countReferrals(idA)) === 6);
} finally {
  // Hapus BERURUTAN, terbalik: referents (punpa referred_by → referrer) lebih
  // dulu, referrer terakhir — agar FK referred_by tidak memblokir penghapusan.
  let allGone = true;
  for (const id of [...createdUsers].reverse()) {
    const ok = await deleteAuthUser(id);
    cleanup.push(Promise.resolve(ok));
    if (!ok) allGone = false;
  }
  check("cleanup semua user tes terhapus", allGone);
}

console.log(failures === 0 ? "\n🎉 Semua tes referral lulus" : `\n${failures} tes gagal`);
process.exit(failures === 0 ? 0 : 1);

async function isExtendedMoreThan(
  row: Record<string, unknown> | null,
  days: number
): Promise<boolean> {
  if (!row?.premium_until) return false;
  const until = new Date(row.premium_until as string).getTime();
  const delta = (until - Date.now()) / 86400000;
  return delta > days + 29.5; // reward ke-2 akan menambah ~30 hari lagi
}
