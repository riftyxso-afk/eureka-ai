/** Server-side Eureka Pro entitlement. */
import { db } from "./supabase/admin";

export type PremiumTier = "promo" | "normal" | "trial" | null;

export interface PremiumStatus {
  isPremium: boolean;
  tier: PremiumTier;
  premiumUntil: string | null;
}

export type PremiumFeature =
  | "assistant-chat"
  | "note-generate"
  | "assistant-image"
  | "web-search"
  | "assistant-quiz"
  | "assistant-flashcards"
  | "bab-regenerate"
  | "solve-then-guide";

export const UPGRADE_URL = "/dashboard-v2/pricing";

/** Durasi trial gratis (7 hari). */
export const TRIAL_DAYS = 7;

export interface ActivatePremiumInput {
  userId: string;
  tier: "promo" | "normal" | "trial";
  /** Lama premium aktif dalam hari (biasanya 30). */
  days: number;
  /** Dicatat di users.pakasir_invoice_number (bila ada). */
  invoiceNumber?: string | null;
  /** Dicatat di users.pakasir_transaction_id (bila ada). */
  transactionId?: string | null;
}

export interface ActivatePremiumResult {
  ok: boolean;
  premiumUntil?: string;
  error?: string;
}

/**
 * Aktivasi premium — satu-satunya jalur untuk menyalakan premium (dipakai
 * webhook Pakasir, trial, dan reward referral). Perpanjangan bersifat aditif:
 * bila user masih premium, durasi ditambahkan dari premium_until yang ada.
 * Mengembalikan premiumUntil bila berhasil.
 */
export async function activatePremium(
  input: ActivatePremiumInput
): Promise<ActivatePremiumResult> {
  let client;
  try {
    client = db();
  } catch {
    return { ok: false, error: "Supabase belum dikonfigurasi." };
  }

  const { data: row } = await client
    .from("users")
    .select("premium_until")
    .eq("id", input.userId)
    .maybeSingle();

  const now = Date.now();
  const existing = row?.premium_until
    ? new Date(row.premium_until).getTime()
    : 0;
  const base = existing > now ? existing : now;
  const premiumUntil = new Date(
    base + input.days * 24 * 60 * 60 * 1000
  ).toISOString();

  const patch: Record<string, unknown> = {
    is_premium: true,
    premium_tier: input.tier,
    premium_until: premiumUntil,
  };
  if (input.invoiceNumber !== undefined) {
    patch.pakasir_invoice_number = input.invoiceNumber;
  }
  if (input.transactionId !== undefined) {
    patch.pakasir_transaction_id = input.transactionId;
  }

  const { error } = await client
    .from("users")
    .update(patch)
    .eq("id", input.userId);
  if (error) {
    console.error("[premium] aktivasi premium gagal:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, premiumUntil };
}

export interface PremiumCheck {
  ok: boolean;
  error?: string;
  status?: number;
  upgradeUrl?: string;
}

const NOT_CONFIGURED: PremiumStatus = {
  isPremium: false,
  tier: null,
  premiumUntil: null,
};

/** Bypass eksplisit untuk mencoba semua fitur chat saat development. */
export function isDevAllAccessEnabled(): boolean {
  return (
    process.env.EUREKA_DEV_ALL_ACCESS === "true" &&
    process.env.NODE_ENV === "development"
  );
}

/**
 * Baca status premium user dari DB. Bila Supabase belum dikonfigurasi
 * (mode dev), semua user dianggap non-premium. Status murni dari
 * `premium_until` (pembayaran satu kali = 30 hari) — tanpa lisensi.
 */
export async function getPremiumStatus(
  userId: string
): Promise<PremiumStatus> {
  if (isDevAllAccessEnabled()) {
    return {
      isPremium: true,
      tier: "normal",
      premiumUntil: null,
    };
  }
  let client;
  try {
    client = db();
  } catch {
    return NOT_CONFIGURED;
  }

  const { data, error } = await client
    .from("users")
    .select("is_premium, premium_until, premium_tier")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return NOT_CONFIGURED;

  const now = Date.now();
  const untilMs = data.premium_until
    ? new Date(data.premium_until).getTime()
    : 0;

  // Kedaluwarsa lokal → nonaktifkan.
  if (data.is_premium !== true || (data.premium_until && (!Number.isFinite(untilMs) || untilMs <= now))) {
    return {
      isPremium: false,
      tier: (data.premium_tier as PremiumTier) ?? null,
      premiumUntil: data.premium_until ?? null,
    };
  }

  return {
    isPremium: true,
    tier: (data.premium_tier as PremiumTier) ?? null,
    premiumUntil: data.premium_until ?? null,
  };
}

/** Catat satu pemakaian fitur (dipanggil setelah berhasil). */
export async function recordFeatureUsage(
  userId: string,
  feature: PremiumFeature
): Promise<void> {
  try {
    await db()
      .from("feature_usage")
      .insert({ user_id: userId, feature });
  } catch (e) {
    console.error("[premium] catat pemakaian gagal:", e);
  }
}

export async function enforcePremium(userId: string, feature: PremiumFeature): Promise<PremiumCheck> {
  if ((await getPremiumStatus(userId)).isPremium) return { ok: true };
  return {
    ok: false,
    error: `${premiumFeatureLabel(feature)} tersedia di Eureka Pro.`,
    status: 402,
    upgradeUrl: UPGRADE_URL,
  };
}

function premiumFeatureLabel(feature: PremiumFeature): string {
  switch (feature) {
    case "assistant-chat":
      return "Chat asisten AI";
    case "note-generate":
      return "Generate catatan AI";
    case "assistant-image":
      return "Generate gambar AI";
    case "web-search":
      return "Pencarian web";
    case "assistant-quiz":
      return "Kuis AI";
    case "assistant-flashcards":
      return "Flashcards AI";
    case "bab-regenerate":
      return "Tulis ulang bab";
    case "solve-then-guide":
      return "Solve-then-Guide (verifikasi soal sulit)";
  }
}

export interface TrialResult {
  ok: boolean;
  error?: string;
  status?: number;
  premiumUntil?: string;
}

/**
 * Klaim trial gratis — 7 hari premium, SEKALI seumur hidup.
 * Bila user sudah pernah claim (trial_claimed_at terisi) atau sedang
 * premium, tolak. Return status premium_until bila berhasil.
 */
export async function claimTrial(userId: string): Promise<TrialResult> {
  let client;
  try {
    client = db();
  } catch {
    return {
      ok: false,
      error: "Supabase belum dikonfigurasi.",
      status: 503,
    };
  }

  const { data: user, error } = await client
    .from("users")
    .select("is_premium, premium_until, trial_claimed_at")
    .eq("id", userId)
    .maybeSingle();
  if (error || !user) {
    return { ok: false, error: "Data user tidak ditemukan.", status: 404 };
  }

  // Sudah pernah claim trial → tolak (sekali seumur hidup).
  if (user.trial_claimed_at) {
    return {
      ok: false,
      error: "Kamu sudah pernah memakai trial gratis.",
      status: 409,
    };
  }

  // Sedang premium aktif → tidak perlu trial.
  const now = Date.now();
  const untilMs = user.premium_until
    ? new Date(user.premium_until).getTime()
    : 0;
  if (user.is_premium === true && untilMs > now) {
    return {
      ok: false,
      error: "Kamu sudah berlangganan aktif.",
      status: 409,
    };
  }

  const activated = await activatePremium({
    userId,
    tier: "trial",
    days: TRIAL_DAYS,
  });
  if (!activated.ok || !activated.premiumUntil) {
    console.error("[premium] claim trial gagal:", activated.error);
    return { ok: false, error: "Gagal mengaktifkan trial.", status: 500 };
  }

  const { error: claimErr } = await client
    .from("users")
    .update({ trial_claimed_at: new Date().toISOString() })
    .eq("id", userId);
  if (claimErr) {
    console.error("[premium] catat trial_claimed_at gagal:", claimErr);
  }

  return { ok: true, premiumUntil: activated.premiumUntil };
}

export interface CancelResult {
  ok: boolean;
  error?: string;
  status?: number;
}

/**
 * Batalkan langganan — nonaktifkan premium segera di DB (tanpa refund).
 * Tanpa panggilan API ke provider pembayaran (Pakasir one-time).
 */
export async function cancelSubscription(userId: string): Promise<CancelResult> {
  let client;
  try {
    client = db();
  } catch {
    return { ok: false, error: "Supabase belum dikonfigurasi.", status: 503 };
  }

  const { data: user, error } = await client
    .from("users")
    .select("is_premium")
    .eq("id", userId)
    .maybeSingle();
  if (error || !user) {
    return { ok: false, error: "Data user tidak ditemukan.", status: 404 };
  }
  if (user.is_premium !== true) {
    return { ok: false, error: "Kamu tidak punya langganan aktif.", status: 409 };
  }

  // Nonaktifkan premium segera di DB — tanpa panggilan API ke provider
  // pembayaran (Pakasir one-time, tidak ada lisensi yang perlu dimatikan).
  const { error: updErr } = await client
    .from("users")
    .update({ is_premium: false })
    .eq("id", userId);
  if (updErr) {
    console.error("[premium] batalkan langganan gagal:", updErr);
    return { ok: false, error: "Gagal membatalkan langganan.", status: 500 };
  }

  return { ok: true };
}
