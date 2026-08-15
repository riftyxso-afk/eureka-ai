/**
 * Fitur Referral Eureka.AI.
 *
 * - Setiap user punya kode referral unik (dibuat lazy saat pertama dibutuhkan).
 * - Pendaftaran baru yang membuka link `?ref=CODE` dicatat sebagai rujukan.
 * - Setelah 5 rujukan valid → pengundang mendapat premium 30 hari SEKALI PAKAI.
 *
 * Atribusi tidak pernah menggagalkan pendaftaran (best-effort, aman).
 */
import { randomBytes } from "crypto";
import { db } from "./supabase/admin";
import { activatePremium } from "./premium";

/** Jumlah rujukan valid untuk mendapat reward. */
export const REFERRAL_GOAL = 5;
/** Lama reward premium (hari). */
export const REFERRAL_REWARD_DAYS = 30;

/** Alfabet tanpa karakter ambigu (0/O, 1/I/L). */
const REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const REFERRAL_CODE_LENGTH = 8;

export function generateReferralCode(): string {
  const bytes = randomBytes(REFERRAL_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += REFERRAL_ALPHABET[bytes[i] % REFERRAL_ALPHABET.length];
  }
  return code;
}

/** Ambil kode referral user; buatkan bila belum ada (lazy, retry saat bentrok). */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const client = db();
  const { data } = await client
    .from("users")
    .select("referral_code")
    .eq("id", userId)
    .maybeSingle();
  if (data?.referral_code) return String(data.referral_code);

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    const { error } = await client
      .from("users")
      .update({ referral_code: code })
      .eq("id", userId);
    if (!error) return code;
    // Bentrok unique index → coba kode lain.
  }
  throw new Error("Gagal membuat kode referral.");
}

/** Cari pengundang berdasarkan kode referral (case-insensitive). */
async function findReferrerByCode(
  code: string
): Promise<{ id: string; email: string | null } | null> {
  const { data } = await db()
    .from("users")
    .select("id, email")
    .ilike("referral_code", code.trim())
    .maybeSingle();
  if (!data) return null;
  return { id: String(data.id), email: data.email ? String(data.email) : null };
}

/** Jumlah rujukan valid yang tercatat untuk user (users.referred_by = userId). */
export async function countReferrals(userId: string): Promise<number> {
  try {
    const { count, error } = await db()
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", userId);
    return error ? 0 : (count ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Catat pendaftaran baru lewat kode referral — HANYA untuk akun BARU.
 * Validasi: kode ada, bukan akun sendiri, email berbeda dari pengundang,
 * dan belum ada atribusi sebelumnya. Setelah atribusi, bila rujukan valid
 * mencapai 5 dan pengundang belum pernah rewarded → beri premium 30 hari
 * (sekali pakai; rujukan setelahnya tidak memberi reward tambahan).
 * Kegagalan apa pun hanya dicatat — tidak menggagalkan pendaftaran.
 */
export async function applyReferral(
  newUserId: string,
  newUserEmail: string,
  refCode: string
): Promise<void> {
  const code = String(refCode ?? "").trim();
  if (code.length < 4) return;

  try {
    const referrer = await findReferrerByCode(code);
    if (!referrer) return;
    // Anti self-referral: kode milik akun sendiri, atau email sama dengan pengundang.
    if (referrer.id === newUserId) return;
    if (
      referrer.email &&
      referrer.email.toLowerCase() === String(newUserEmail ?? "").toLowerCase()
    ) {
      return;
    }

    const client = db();

    // Jangan menimpa atribusi yang sudah ada.
    const { data: existing } = await client
      .from("users")
      .select("referred_by")
      .eq("id", newUserId)
      .maybeSingle();
    if (existing?.referred_by) return;

    await client
      .from("users")
      .update({ referred_by: referrer.id })
      .eq("id", newUserId);

    // Reward: capai 5 rujukan valid & belum pernah rewarded → premium 30 hari.
    const { data: referrerRow } = await client
      .from("users")
      .select("referral_rewarded")
      .eq("id", referrer.id)
      .maybeSingle();
    if (referrerRow?.referral_rewarded) return;

    const count = await countReferrals(referrer.id);
    if (count >= REFERRAL_GOAL) {
      const result = await activatePremium({
        userId: referrer.id,
        tier: "normal",
        days: REFERRAL_REWARD_DAYS,
      });
      if (result.ok) {
        await client
          .from("users")
          .update({ referral_rewarded: true })
          .eq("id", referrer.id);
        console.log(
          `[referral] user ${referrer.id} mencapai ${count} rujukan valid → premium ${REFERRAL_REWARD_DAYS} hari`
        );
      }
    }
  } catch (e) {
    console.warn("[referral] atribusi dilewati (pendaftaran tetap berhasil):", e);
  }
}

export interface ClaimReferralResult {
  ok: boolean;
  alreadyClaimed?: boolean;
  premiumUntil?: string;
  error?: string;
}

/**
 * Klaim reward referral secara manual (dari popup "Klaim Premium").
 * Hanya berlaku bila rujukan valid sudah mencapai goal dan belum pernah
 * rewarded. Idempoten: bila sudah rewarded → { ok, alreadyClaimed: true }.
 * Auto-reward di applyReferral tetap jalan; endpoint ini menutup celah
 * bila reward belum sempat diberikan (mis. kegagalan sesaat).
 */
export async function claimReferralReward(
  userId: string
): Promise<ClaimReferralResult> {
  try {
    const client = db();
    const { data } = await client
      .from("users")
      .select("referral_rewarded")
      .eq("id", userId)
      .maybeSingle();
    if (data?.referral_rewarded) {
      return { ok: true, alreadyClaimed: true };
    }

    const count = await countReferrals(userId);
    if (count < REFERRAL_GOAL) {
      return {
        ok: false,
        error: `Belum mencapai ${REFERRAL_GOAL} rujukan valid (sekarang ${count}).`,
      };
    }

    const result = await activatePremium({
      userId,
      tier: "normal",
      days: REFERRAL_REWARD_DAYS,
    });
    if (!result.ok || !result.premiumUntil) {
      return { ok: false, error: result.error ?? "Gagal mengaktifkan reward." };
    }

    await client
      .from("users")
      .update({ referral_rewarded: true })
      .eq("id", userId);

    return { ok: true, premiumUntil: result.premiumUntil };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Gagal klaim reward.",
    };
  }
}

export interface ReferralStatus {
  code: string;
  count: number;
  goal: number;
  rewarded: boolean;
  link: string;
}

/** Status referral untuk user: kode, jumlah rujukan (x/5), status reward, link. */
export async function getReferralStatus(
  userId: string,
  origin: string
): Promise<ReferralStatus> {
  const code = await getOrCreateReferralCode(userId);
  const [{ data }, count] = await Promise.all([
    db()
      .from("users")
      .select("referral_rewarded")
      .eq("id", userId)
      .maybeSingle(),
    countReferrals(userId),
  ]);
  const base = String(origin ?? "").replace(/\/+$/, "");
  return {
    code,
    count,
    goal: REFERRAL_GOAL,
    rewarded: data?.referral_rewarded === true,
    link: `${base}/register?ref=${encodeURIComponent(code)}`,
  };
}
