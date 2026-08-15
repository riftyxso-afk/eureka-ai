/**
 * Pakasir API Client — payment gateway untuk langganan Pro.
 *
 * Docs: https://pakasir.com/p/docs
 * - Hosted payment page: `https://app.pakasir.com/pay/{slug}/{amount}?order_id=...&redirect=...`
 *   (tombol "Kembali ke halaman merchant" muncul setelah bayar sukses).
 * - Webhook (tanpa signature): `POST { amount, order_id, project, status: "completed",
 *   payment_method, completed_at }` dikirim ke Webhook URL proyek.
 * - Verifikasi status (disarankan docs): `GET /api/transactiondetail?project=&amount=&order_id=&api_key=`
 * - Sandbox: `POST /api/paymentsimulation` untuk mensimulasikan pembayaran + webhook.
 *
 * Karena webhook Pakasir TIDAK bersignature, verifikasi dilakukan fail-closed:
 * cocokkan project + order_id + amount tercatat, lalu konfirmasi status via
 * `transactiondetail` (authoritative) sebelum mengaktifkan premium.
 */
import { randomBytes } from "node:crypto";

export const PAKASIR_BASE_URL = "https://app.pakasir.com";

export function isPakasirConfigured(): boolean {
  const project = process.env.PAKASIR_PROJECT?.trim() ?? "";
  const apiKey = process.env.PAKASIR_API_KEY?.trim() ?? "";
  return (
    project.length > 0 &&
    apiKey.length > 0 &&
    project !== "your-pakasir-project" &&
    apiKey !== "your-pakasir-api-key"
  );
}

function pakasirProject(): string {
  return process.env.PAKASIR_PROJECT?.trim() ?? "";
}

function pakasirApiKey(): string {
  return process.env.PAKASIR_API_KEY?.trim() ?? "";
}

/**
 * Generate nomor invoice unik — alfanumerik, tanpa simbol (aman untuk URL),
 * panjang ≤ 30 karakter: `EKA{YYYYMMDDHHmmss}{6 hex}`.
 */
export function generateInvoiceNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const rand = randomBytes(3).toString("hex").toUpperCase(); // 6 char hex
  return `EKA${y}${m}${d}${hh}${mm}${ss}${rand}`;
}

export interface BuildPayUrlInput {
  amount: number; // Rupiah (integer) — nominal yang ditagihkan
  orderId: string; // order_id / nomor invoice
  redirectUrl: string; // URL kembali setelah bayar (netral, ?upgrade=done)
}

/** Bangun URL hosted payment page Pakasir. */
export function buildPayUrl(input: BuildPayUrlInput): string {
  if (!isPakasirConfigured()) {
    throw new Error(
      "Pakasir belum dikonfigurasi. Isi PAKASIR_PROJECT & PAKASIR_API_KEY di .env.local."
    );
  }
  const base = `${PAKASIR_BASE_URL}/pay/${encodeURIComponent(
    pakasirProject()
  )}/${input.amount}`;
  const params = new URLSearchParams({
    order_id: input.orderId,
    redirect: input.redirectUrl,
  });
  return `${base}?${params.toString()}`;
}

export interface TransactionDetailResult {
  ok: boolean;
  /** status transaksi (lowercase), mis. "completed" — null bila tidak ada. */
  status: string | null;
  raw: unknown;
}

/**
 * Verifikasi status transaksi via API `transactiondetail` (authoritative).
 * Pakasir merekomendasikan pengecekan ini untuk memvalidasi webhook
 * (karena webhook tidak bersignature). Melempar error bila request gagal.
 */
export async function verifyTransactionDetail(input: {
  orderId: string;
  amount: number;
}): Promise<TransactionDetailResult> {
  const params = new URLSearchParams({
    project: pakasirProject(),
    amount: String(input.amount),
    order_id: input.orderId,
    api_key: pakasirApiKey(),
  });
  const res = await fetch(
    `${PAKASIR_BASE_URL}/api/transactiondetail?${params.toString()}`,
    { signal: AbortSignal.timeout(10000) }
  );
  const body = (await res.json().catch(() => null)) as {
    transaction?: { status?: string; [k: string]: unknown };
    error?: unknown;
  } | null;
  if (!res.ok || !body?.transaction) {
    throw new Error(
      `transactiondetail gagal (HTTP ${res.status}): ${JSON.stringify(
        body ?? null
      ).slice(0, 300)}`
    );
  }
  return {
    ok: true,
    status: String(body.transaction.status ?? "").trim().toLowerCase() || null,
    raw: body,
  };
}
