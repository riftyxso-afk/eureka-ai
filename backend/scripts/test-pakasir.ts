/**
 * Smoke test integrasi Pakasir (sandbox).
 *   1. format URL buildPayUrl (encode redirect, order_id, amount)
 *   2. transactiondetail API (hanya bila PAKASIR_PROJECT/PAKASIR_API_KEY terisi)
 *
 * Jalankan dari backend/:  npx tsx scripts/test-pakasir.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const PAKASIR_PROJECT = process.env.PAKASIR_PROJECT?.trim() ?? "";
const PAKASIR_API_KEY = process.env.PAKASIR_API_KEY?.trim() ?? "";

let failures = 0;
function check(name: string, ok: boolean, extra = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
}

const { buildPayUrl, generateInvoiceNumber, isPakasirConfigured, verifyTransactionDetail } =
  await import("../../lib/pakasir");

// ── 1. format URL ──────────────────────────────────────────
if (PAKASIR_PROJECT && PAKASIR_API_KEY) {
  const orderId = generateInvoiceNumber();
  const url = buildPayUrl({
    amount: 59000,
    orderId,
    redirectUrl: "http://localhost:3000/dashboard?upgrade=done",
  });
  check("1a. isPakasirConfigured → true", isPakasirConfigured());
  check(
    "1b. URL memuat /pay/{slug}/59000",
    url.startsWith(`https://app.pakasir.com/pay/${PAKASIR_PROJECT}/59000`),
    url.slice(0, 80)
  );
  check("1c. order_id ada di query", url.includes(`order_id=${orderId}`));
  check(
    "1d. redirect ter-encode (query %2Fdashboard)",
    url.includes("redirect=http%3A%2F%2Flocalhost%3A3000%2Fdashboard%3Fupgrade%3Ddone"),
    url.slice(-90)
  );
  console.log(`\nenv: project=${PAKASIR_PROJECT.slice(0, 12)}… apiKey=${PAKASIR_API_KEY.slice(0, 6)}…`);

  // ── 2. transactiondetail (sandbox, butuh API key) ────────
  // Buat order sungguhan via transactioncreate (qris) lalu cek detail-nya,
  // dan bersihkan via transactioncancel.
  const createBody = {
    project: PAKASIR_PROJECT,
    order_id: `EKATEST${Date.now()}`,
    amount: 5000,
    api_key: PAKASIR_API_KEY,
  };
  const createRes = await fetch("https://app.pakasir.com/api/transactioncreate/qris", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createBody),
  });
  const createJson = (await createRes.json().catch(() => null)) as {
    payment?: { order_id?: string; payment_number?: string; expired_at?: string };
    error?: unknown;
  } | null;
  check("2a. transactioncreate → 200 + payment_number", createRes.status === 200 && !!createJson?.payment?.payment_number, `HTTP ${createRes.status}`);

  if (createJson?.payment?.order_id) {
    try {
      const detail = await verifyTransactionDetail({
        orderId: createJson.payment.order_id,
        amount: createBody.amount,
      });
      check("2b. transactiondetail bisa dibaca", detail.ok, `status=${detail.status ?? "-"}`);
    } catch (e) {
      check("2b. transactiondetail bisa dibaca", false, (e as Error).message.slice(0, 120));
    }
    // Bersihkan order tes
    await fetch("https://app.pakasir.com/api/transactioncancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createBody),
    });
    console.log("   (order tes dicancel)");
  }
} else {
  console.log("⚠️  PAKASIR_PROJECT / PAKASIR_API_KEY belum di-set di backend/.env.local — hanya cek format tanpa env.");
  check("1e. isPakasirConfigured → false (belum di-set)", !isPakasirConfigured());
  try {
    buildPayUrl({ amount: 5000, orderId: "EKA1", redirectUrl: "http://localhost:3000/dashboard?upgrade=done" });
    check("1f. buildPayUrl menolak tanpa konfigurasi", false);
  } catch {
    check("1f. buildPayUrl menolak tanpa konfigurasi", true);
  }
}

console.log(failures === 0 ? "\n🎉 Semua tes Pakasir lulus" : `\n${failures} tes gagal`);
process.exit(failures === 0 ? 0 : 1);
