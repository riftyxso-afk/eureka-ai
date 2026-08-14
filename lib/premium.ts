/**
 * Premium gating — status langganan Mayar + kuota free tier.
 *
 * Setiap route AI berbiaya tinggi memanggil `enforcePremium(userId, feature)`
 * SETELAH auth user lolos. Keputusan 100% server-side; frontend hanya
 * menampilkan hasilnya (402 → notifikasi + tombol ke /pricing).
 *
 * Kuota free tier (usulan — bisa diubah di FEATURE_LIMITS):
 *   - assistant-chat       : 10 pesan/hari  (dihitung dari ai_chat_messages)
 *   - note-generate        : 3 catatan/bulan (dihitung dari notes)
 *   - assistant-image      : wajib premium
 *   - web-search           : wajib premium
 *   - assistant-quiz       : 2/hari   (tabel feature_usage)
 *   - assistant-flashcards : 2/hari   (tabel feature_usage)
 *   - bab-regenerate       : 3/bulan  (tabel feature_usage)
 */
import { db } from "./supabase/admin";
import { verifyLicense } from "./mayar";

export type PremiumTier = "promo" | "normal" | "trial" | null;

export interface PremiumStatus {
  isPremium: boolean;
  tier: PremiumTier;
  premiumUntil: string | null;
  licenseCode: string | null;
}

export type PremiumFeature =
  | "assistant-chat"
  | "note-generate"
  | "assistant-image"
  | "web-search"
  | "assistant-quiz"
  | "assistant-flashcards"
  | "bab-regenerate";

interface FeatureLimit {
  /** true = fitur hanya untuk premium (tanpa kuota free). */
  premiumOnly: boolean;
  /** Kuota untuk user free; 0 bila premiumOnly. */
  limit: number;
  /** Periode kuota. */
  period: "day" | "month";
}

export const FEATURE_LIMITS: Record<PremiumFeature, FeatureLimit> = {
  "assistant-chat": { premiumOnly: false, limit: 10, period: "day" },
  "note-generate": { premiumOnly: false, limit: 3, period: "month" },
  "assistant-image": { premiumOnly: true, limit: 0, period: "day" },
  "web-search": { premiumOnly: true, limit: 0, period: "day" },
  "assistant-quiz": { premiumOnly: false, limit: 2, period: "day" },
  "assistant-flashcards": { premiumOnly: false, limit: 2, period: "day" },
  "bab-regenerate": { premiumOnly: false, limit: 3, period: "month" },
};

export const UPGRADE_URL = "/pricing";

/** Durasi trial gratis (7 hari). */
export const TRIAL_DAYS = 7;

export interface PremiumCheck {
  ok: boolean;
  error?: string;
  status?: number;
  upgradeUrl?: string;
}

/** Batas bawah tanggal periode (hari/bulan) untuk query kuota. */
function periodStart(period: "day" | "month"): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === "month") d.setDate(1);
  return d;
}

const NOT_CONFIGURED: PremiumStatus = {
  isPremium: false,
  tier: null,
  premiumUntil: null,
  licenseCode: null,
};

/**
 * Baca status premium user dari DB + verifikasi lisensi Mayar bila
 * `premium_until` hampir habis (D4). Bila Supabase belum dikonfigurasi
 * (mode dev), semua user dianggap non-premium.
 */
export async function getPremiumStatus(
  userId: string
): Promise<PremiumStatus> {
  let client;
  try {
    client = db();
  } catch {
    return NOT_CONFIGURED;
  }

  const { data, error } = await client
    .from("users")
    .select(
      "is_premium, premium_until, premium_tier, mayar_license_code, mayar_product_id"
    )
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return NOT_CONFIGURED;

  const now = Date.now();
  const untilMs = data.premium_until
    ? new Date(data.premium_until).getTime()
    : 0;

  // Kedaluwarsa lokal → nonaktifkan.
  if ((data.is_premium === true && untilMs && untilMs <= now) || !data.is_premium) {
    if (data.is_premium === true && untilMs && untilMs <= now) {
      await client
        .from("users")
        .update({ is_premium: false })
        .eq("id", userId)
        .maybeSingle();
    }
    return {
      isPremium: false,
      tier: (data.premium_tier as PremiumTier) ?? null,
      premiumUntil: data.premium_until ?? null,
      licenseCode: data.mayar_license_code ?? null,
    };
  }

  // Verifikasi lisensi ke Mayar bila < 12 jam lagi habis.
  const twelveHoursMs = 12 * 60 * 60 * 1000;
  if (
    data.mayar_license_code &&
    data.mayar_product_id &&
    untilMs - now < twelveHoursMs
  ) {
    try {
      const license = await verifyLicense(
        data.mayar_license_code,
        data.mayar_product_id
      );
      if (!license.isLicenseActive) {
        await client
          .from("users")
          .update({ is_premium: false })
          .eq("id", userId)
          .maybeSingle();
        return {
          isPremium: false,
          tier: (data.premium_tier as PremiumTier) ?? null,
          premiumUntil: data.premium_until ?? null,
          licenseCode: data.mayar_license_code ?? null,
        };
      }
      if (license.expiredAt) {
        await client
          .from("users")
          .update({ premium_until: license.expiredAt })
          .eq("id", userId)
          .maybeSingle();
      }
    } catch (e) {
      // Gagal verifikasi → pertahankan status saat ini (jangan blokir user).
      console.error("[premium] verifikasi lisensi gagal:", e);
    }
  }

  return {
    isPremium: true,
    tier: (data.premium_tier as PremiumTier) ?? null,
    premiumUntil: data.premium_until ?? null,
    licenseCode: data.mayar_license_code ?? null,
  };
}

/** Hitung pemakaian fitur oleh user sejak awal periode. */
async function countUsage(
  userId: string,
  feature: PremiumFeature,
  period: "day" | "month"
): Promise<number> {
  const client = db();
  const since = periodStart(period).toISOString();

  if (feature === "assistant-chat") {
    // Jumlah pesan user hari ini di semua sesi milik user.
    const { data: sessions, error: sessErr } = await client
      .from("ai_chat_sessions")
      .select("id")
      .eq("user_id", userId);
    if (sessErr || !sessions?.length) return 0;
    const ids = sessions.map((s) => s.id as string);
    const { count, error } = await client
      .from("ai_chat_messages")
      .select("id", { count: "exact", head: true })
      .in("session_id", ids)
      .eq("role", "user")
      .gte("created_at", since);
    return error ? 0 : (count ?? 0);
  }

  if (feature === "note-generate") {
    // Jumlah catatan yang dibuat bulan ini (semua generate masuk sini).
    const { count, error } = await client
      .from("notes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);
    return error ? 0 : (count ?? 0);
  }

  // Fitur berbasis feature_usage (quiz, flashcards, bab-regenerate).
  const { count, error } = await client
    .from("feature_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature", feature)
    .gte("used_at", since);
  return error ? 0 : (count ?? 0);
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

/**
 * Enforce premium: periksa status + kuota untuk sebuah fitur.
 * Return `{ ok: true }` bila boleh lanjut, atau `{ ok: false, status: 402,
 * upgradeUrl }` dengan pesan yang bisa langsung jadi respons API.
 */
export async function enforcePremium(
  userId: string,
  feature: PremiumFeature
): Promise<PremiumCheck> {
  const status = await getPremiumStatus(userId);
  if (status.isPremium) return { ok: true };

  const limit = FEATURE_LIMITS[feature];
  if (limit.premiumOnly) {
    return {
      ok: false,
      error: `${premiumFeatureLabel(
        feature
      )} hanya untuk pengguna Pro. Upgrade untuk akses tanpa batas.`,
      status: 402,
      upgradeUrl: UPGRADE_URL,
    };
  }

  let used = 0;
  try {
    used = await countUsage(userId, feature, limit.period);
  } catch (e) {
    // Supabase belum dikonfigurasi (mode dev) → jangan blokir.
    console.warn("[premium] hitung kuota dilewati (dev tanpa DB):", e);
    return { ok: true };
  }
  if (used >= limit.limit) {
    const periodLabel = limit.period === "day" ? "hari ini" : "bulan ini";
    return {
      ok: false,
      error: `Kamu sudah memakai ${premiumFeatureLabel(
        feature
      )} ${used} kali ${periodLabel} (batas gratis ${limit.limit}). Upgrade ke Pro untuk akses tanpa batas.`,
      status: 402,
      upgradeUrl: UPGRADE_URL,
    };
  }

  return { ok: true };
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

  const premiumUntil = new Date(
    now + TRIAL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error: updErr } = await client
    .from("users")
    .update({
      is_premium: true,
      premium_tier: "trial",
      premium_until: premiumUntil,
      trial_claimed_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (updErr) {
    console.error("[premium] claim trial gagal:", updErr);
    return { ok: false, error: "Gagal mengaktifkan trial.", status: 500 };
  }

  return { ok: true, premiumUntil };
}

export interface CancelResult {
  ok: boolean;
  error?: string;
  status?: number;
}

/**
 * Batalkan langganan — nonaktifkan premium segera di DB (tanpa refund).
 * Bila user punya license code Mayar, coba nonaktifkan lisensi juga
 * (best-effort, tidak menggagalkan proses bila Mayar error).
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
    .select("is_premium, mayar_license_code, mayar_product_id")
    .eq("id", userId)
    .maybeSingle();
  if (error || !user) {
    return { ok: false, error: "Data user tidak ditemukan.", status: 404 };
  }
  if (user.is_premium !== true) {
    return { ok: false, error: "Kamu tidak punya langganan aktif.", status: 409 };
  }

  // Nonaktifkan lisensi di Mayar (best-effort, jangan blokir proses).
  if (user.mayar_license_code && user.mayar_product_id) {
    try {
      const { deactivateLicense } = await import("./mayar");
      await deactivateLicense(user.mayar_license_code, user.mayar_product_id);
      console.log(`[premium] lisensi Mayar dinonaktifkan untuk ${userId}`);
    } catch (e) {
      console.warn(
        "[premium] gagal nonaktifkan lisensi Mayar (dilanjutkan):",
        e
      );
    }
  }

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
