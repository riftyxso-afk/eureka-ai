/**
 * Mayar.id API Client — payment gateway untuk langganan Pro.
 *
 * Docs: https://docs.mayar.id
 * - Checkout:  POST /hl/v1/payment/create  → { data: { id, transactionId, link } }
 * - Lisensi:   POST /saas/v1/license/verify → { isLicenseActive, licenseCode: { expiredAt, ... } }
 * - Webhook:   POST /hl/v1/webhook/register → { urlHook }
 *
 * Base URL: production `https://api.mayar.id`, sandbox `https://api.mayar.io`
 * (dipilih via env MAYAR_SANDBOX=true, default produksi).
 */
export const MAYAR_BASE_URL = (() => {
  if (process.env.MAYAR_SANDBOX === "true") return "https://api.mayar.io";
  return "https://api.mayar.id";
})();

export function isMayarConfigured(): boolean {
  const key = process.env.MAYAR_API_KEY ?? "";
  return key.length > 10 && key !== "your-mayar-api-key";
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.MAYAR_API_KEY ?? ""}`,
    "Content-Type": "application/json",
  };
}

export interface MayarCreatePaymentInput {
  name: string;
  email: string;
  amount: number; // Rupiah (integer)
  redirectUrl: string;
  description: string;
  mobile?: string;
}

export interface MayarPaymentResult {
  id: string;
  transactionId: string;
  link: string;
}

/** Buat transaksi checkout (single payment request) ke Mayar. */
export async function createPayment(
  input: MayarCreatePaymentInput
): Promise<MayarPaymentResult> {
  if (!isMayarConfigured()) {
    throw new Error(
      "Mayar belum dikonfigurasi. Isi MAYAR_API_KEY di .env.local."
    );
  }

  const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 jam
  const res = await fetch(`${MAYAR_BASE_URL}/hl/v1/payment/create`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      amount: input.amount,
      redirectUrl: input.redirectUrl,
      description: input.description,
      ...(input.mobile ? { mobile: input.mobile } : {}),
      expiredAt,
    }),
    signal: AbortSignal.timeout(30000),
  });

  const body = (await res.json().catch(() => null)) as {
    statusCode?: number;
    messages?: string;
    data?: { id?: string; transactionId?: string; transaction_id?: string; link?: string };
  } | null;

  if (!res.ok || !body?.data?.link) {
    const msg =
      body?.messages || `Mayar error (HTTP ${res.status})`;
    throw new Error(msg);
  }

  return {
    id: body.data.id ?? "",
    transactionId:
      body.data.transactionId ?? body.data.transaction_id ?? "",
    link: body.data.link,
  };
}

export interface MayarLicenseVerifyResult {
  isLicenseActive: boolean;
  expiredAt: string | null;
  licenseCode: string | null;
  membershipTierName: string | null;
}

/** Verifikasi lisensi langganan SaaS ke Mayar. */
export async function verifyLicense(
  licenseCode: string,
  productId: string
): Promise<MayarLicenseVerifyResult> {
  const res = await fetch(`${MAYAR_BASE_URL}/saas/v1/license/verify`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ licenseCode, productId }),
    signal: AbortSignal.timeout(15000),
  });

  const body = (await res.json().catch(() => null)) as {
    statusCode?: number;
    isLicenseActive?: boolean;
    licenseCode?: {
      licenseCode?: string;
      status?: string;
      expiredAt?: string;
      membershipTierName?: string;
    } | null;
  } | null;

  const active =
    body?.isLicenseActive === true ||
    body?.licenseCode?.status === "ACTIVE";

  return {
    isLicenseActive: active,
    expiredAt: body?.licenseCode?.expiredAt ?? null,
    licenseCode: body?.licenseCode?.licenseCode ?? null,
    membershipTierName: body?.licenseCode?.membershipTierName ?? null,
  };
}

/**
 * Nonaktifkan lisensi langganan di Mayar (best-effort saat user membatalkan
 * langganan). Bila license code belum tersimpan di DB, dilewati tanpa error.
 */
export async function deactivateLicense(
  licenseCode: string,
  productId: string
): Promise<void> {
  const res = await fetch(`${MAYAR_BASE_URL}/saas/v1/license/deactivate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ licenseCode, productId }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { messages?: string } | null;
    throw new Error(body?.messages || `Mayar deactivate gagal (HTTP ${res.status})`);
  }
}

/** Daftarkan URL webhook Mayar (opsional — bisa juga lewat dashboard). */
export async function registerWebhook(urlHook: string): Promise<void> {
  const res = await fetch(`${MAYAR_BASE_URL}/hl/v1/webhook/register`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ urlHook }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { messages?: string } | null;
    throw new Error(body?.messages || `Mayar webhook register gagal (HTTP ${res.status})`);
  }
}
