## Why

Payment gateway langganan Pro Eureka.AI saat ini terikat pada Mayar.id (model Membership SaaS license-based dengan verifikasi lisensi berulang). User memutuskan pindah ke **DOKU** (https://www.doku.com/) sebagai payment gateway — semua kode, konfigurasi, kolom DB, dan referensi UI Mayar harus dihapus dan diganti dengan integrasi DOKU Checkout.

## What Changes

- **BREAKING — Ganti provider checkout**: `lib/mayar.ts` dihapus, diganti `lib/doku.ts` yang memanggil DOKU Checkout `POST /checkout/v1/payment` (sandbox `api-sandbox.doku.com`, prod `api.doku.com`) dengan header `Client-Id`, `Request-Id`, `Request-Timestamp`, `Signature: HMACSHA256=...`, body `order`/`customer`, dan mengembalikan `response.payment.url` untuk redirect user.
- **BREAKING — Ganti webhook**: `app/api/payments/webhook/route.ts` ditulis ulang untuk menerima HTTP Notification DOKU, memverifikasi signature HMAC-SHA256 (fail-closed → 401), idempotensi via `invoice_number` unik, dan mengaktifkan premium 30 hari saat notifikasi status `SUCCESS`.
- **BREAKING — Hapus model lisensi**: verifikasi lisensi (`saas/v1/license/verify`) dan `deactivateLicense` dihapus dari `lib/premium.ts`; status premium murni dari DB (`premium_until = now + 30 hari` per pembayaran sukses). Pembatalan langganan hanya menonaktifkan premium di DB tanpa panggilan API eksternal.
- **BREAKING — Env baru**: `MAYAR_API_KEY`, `MAYAR_WEBHOOK_TOKEN`, `MAYAR_MERCHANT_ID`, `MAYAR_PRODUCT_ID_PROMO`, `MAYAR_PRODUCT_ID_NORMAL`, `MAYAR_REDIRECT_URL`, `MAYAR_SANDBOX` dihapus dari `.env.example`, `SUPABASE_SETUP_GUIDE.md`, `render.yaml`; diganti `DOKU_CLIENT_ID`, `DOKU_SECRET_KEY`, `DOKU_SANDBOX`, `DOKU_REDIRECT_URL`.
- **BREAKING — Migrasi DB**: patch baru (mis. `supabase_patch_009_doku_payments.sql`) menambah kolom `doku_invoice_number`/`doku_transaction_id`, tabel `doku_payment_requests` (invoice → user + tier + amount, untuk pencocokan webhook) dan `doku_notification_events` (idempotensi), menghapus tabel `mayar_webhook_events` dan kolom `mayar_license_code`/`mayar_product_id`/`mayar_customer_id`.
- **UI**: teks "Mayar.id"/"Ke Mayar…" di `app/pricing/page.tsx`, `components/KemerdekaanPopup.tsx`, `components/PremiumSuccessPopup.tsx` diganti DOKU; popup sukses (`?upgrade=success`) tetap berfungsi via `order.callback_url`.
- **Pertahankan**: dua tier (promo Rp 5.000, normal Rp 59.000), kode diskon (`lib/discount.ts`), trial 7 hari, gating premium server-side, endpoint status/cancel/trial — hanya backend pembayarannya yang diganti.
- **Keputusan renewal**: pembayaran DOKU bersifat one-time → 1x bayar = premium aktif 30 hari (tanpa auto-renew), sesuai pilihan user.

## Capabilities

### New Capabilities
- `doku-payments`: Integrasi payment gateway DOKU — membuat checkout via DOKU Checkout API, menerima & memverifikasi HTTP Notification, mengaktifkan premium 30 hari per pembayaran sukses, dan menghapus seluruh jejak Mayar.id dari kode, env, DB, dan UI.

### Modified Capabilities
- `mayar-subscription`: Seluruh requirement digantikan oleh `doku-payments` — spesifikasi lama dihapus (spec ini menjadi delta yang menggantikannya; saat sync/archive, `openspec/specs/mayar-subscription/spec.md` dihapus dan `openspec/specs/doku-payments/spec.md` dibuat).

## Impact

- **Frontend**: `app/pricing/page.tsx`, `components/KemerdekaanPopup.tsx`, `components/PremiumSuccessPopup.tsx`, `lib/usePremium.ts` (hapus field `licenseCode` dari tipe).
- **API routes**: `app/api/payments/checkout/route.ts`, `app/api/payments/webhook/route.ts`, `app/api/payments/cancel/route.ts` (via `lib/premium.ts`).
- **Lib**: hapus `lib/mayar.ts`; tulis `lib/doku.ts`; ubah `lib/premium.ts`, `lib/discount.ts` (komentar/minor).
- **DB (Supabase)**: patch migrasi 009 — kolom `doku_invoice_number`, `doku_transaction_id`; tabel `doku_payment_requests` + `doku_notification_events`; drop `mayar_webhook_events` + kolom `mayar_*`.
- **Konfigurasi**: `.env.example`, `SUPABASE_SETUP_GUIDE.md`, `render.yaml`, `backend/src/routes.ts` (komentar).
- **Dependensi**: tidak ada library baru — memakai `fetch` + `crypto` (Node.js) untuk signature HMAC-SHA256; perlu akun DOKU (Client ID & Secret Key) dari DOKU Back Office + konfigurasi Notification URL.
