## 1. Client DOKU & Helper Signature

- [x] 1.1 Buat `lib/doku.ts` — konfigurasi base URL sandbox/prod dari env `DOKU_SANDBOX` + `isDokuConfigured()` (cek `DOKU_CLIENT_ID` & `DOKU_SECRET_KEY`)
- [x] 1.2 Implementasikan helper signature: `generateSignature(clientId, requestId, timestamp, requestTarget, body, secretKey)` → `HMACSHA256=` + base64(HMAC-SHA256) dari komponen `Client-Id/Request-Id/Request-Timestamp/Request-Target/Digest` (digest = base64(SHA256(rawBody))) memakai `node:crypto`
- [x] 1.3 Implementasikan `createCheckoutPayment({ amount, invoiceNumber, customerName, customerEmail, customerId, redirectUrl, description })` → POST `/checkout/v1/payment` dengan header `Client-Id`, `Request-Id` (uuid), `Request-Timestamp` (ISO8601 UTC), `Signature`; body `order`/`customer`; return `{ url, tokenId, sessionId, invoiceNumber }` dari `response.payment.url` dkk; error DOKU → throw dengan pesan
- [x] 1.4 Implementasikan `generateInvoiceNumber()` — alfanumerik ≤ 30 char tanpa simbol, prefix `EKA` + timestamp + random (D3 design)
- [x] 1.5 Implementasikan `verifyNotificationSignature({ clientId, requestId, timestamp, signature }, rawBody, path)` → boolean (constant-time compare)

## 2. API Routes

- [x] 2.1 Rewrite `app/api/payments/checkout/route.ts` — validasi tier promo/normal + kode diskon (tetap `lib/discount.ts`) → catat `doku_payment_requests` (invoice → user + tier + amount) SEBELUM memanggil DOKU → `createCheckoutPayment` dengan `invoiceNumber` baru → `{ link, transactionId: invoiceNumber, amount, discount }`; `callback_url` = `DOKU_REDIRECT_URL` atau `${origin}/dashboard?upgrade=success`; DOKU error → 502; ganti cek `isMayarConfigured` → `isDokuConfigured`
- [x] 2.2 Rewrite `app/api/payments/webhook/route.ts` — baca raw body → verifikasi signature DOKU (fail-closed: `DOKU_SECRET_KEY` kosong → 503, signature salah → 401) → idempotensi via `doku_notification_events.invoice_number` UNIQUE (duplikat → 200) → status sukses: cocokkan `doku_payment_requests` by invoice (tier & amount dari catatan checkout, verifikasi amount konsisten), fallback cari user by email case-insensitive + tier dari amount (5000→promo, 59000→normal), set `is_premium=true`, `premium_until = now + 30 hari`, simpan `doku_invoice_number`/`doku_transaction_id`, tandai payment request `paid`; status lain → 200 tanpa aksi; simpan raw payload untuk audit
- [x] 2.3 Verifikasi route `app/api/payments/cancel/route.ts` & `status/route.ts` & `trial/route.ts` tetap berfungsi (kontrak respons status tanpa `licenseCode`)

## 3. Bersihkan Logika Premium & Lisensi

- [x] 3.1 Hapus dari `lib/premium.ts`: import `verifyLicense`, blok verifikasi lisensi < 12 jam di `getPremiumStatus`, kolom `mayar_license_code`/`mayar_product_id` dari select, field `licenseCode` dari `PremiumStatus`, dan panggilan `deactivateLicense` di `cancelSubscription` (cukup update DB)
- [x] 3.2 Update `lib/usePremium.ts` — hapus `licenseCode` dari tipe `PremiumStatus` dan normalisasi respons
- [x] 3.3 Update komentar `lib/discount.ts` (Mayar → DOKU, `MIN_AMOUNT` tetap)
- [x] 3.4 Hapus `lib/mayar.ts` setelah tidak ada referensi tersisa

## 4. Migrasi Database (Supabase)

- [x] 4.1 Buat `supabase_patch_009_doku_payments.sql` — `ADD COLUMN IF NOT EXISTS doku_invoice_number TEXT, doku_transaction_id TEXT` di `public.users`
- [x] 4.2 Buat tabel `public.doku_payment_requests` (`invoice_number TEXT UNIQUE NOT NULL`, `user_id`, `amount`, `tier`, `status`, `paid_at`) dan `public.doku_notification_events` (`invoice_number TEXT UNIQUE`, `status`, `amount`, `payload JSONB`, `processed_at`, `created_at`) + RLS service_role (pola patch 007)
- [x] 4.3 Hapus jejak Mayar di migration: `DROP TABLE IF EXISTS public.mayar_webhook_events` dan `ALTER TABLE public.users DROP COLUMN IF EXISTS mayar_license_code, mayar_product_id, mayar_customer_id` (backup dump dulu sebelum eksekusi)
- [x] 4.4 Jalankan migration 009 di Supabase & verifikasi kolom/tabel (guna `is_premium`, `premium_until`, `premium_tier`, `trial_claimed_at` tetap) — ✅ sudah dijalankan user & diverifikasi (`check-db.ts`)
  - ⚠️ Temuan di luar scope: RPC `increment_discount_use` (patch 008) tidak ada di DB → `consumeDiscount` diam-diam gagal; perlu dijalankan ulang bagian function patch 008

## 5. Env & Dokumentasi

- [x] 5.1 Update `.env.example` (root & backend) — tambah `DOKU_CLIENT_ID`, `DOKU_SECRET_KEY`, `DOKU_SANDBOX`, `DOKU_REDIRECT_URL`; hapus semua `MAYAR_*` (termasuk `backend/.env.local`)
- [x] 5.2 Update `SUPABASE_SETUP_GUIDE.md` — tabel env DOKU (Client ID/Secret Key dari DOKU Back Office), langkah daftarkan Notification URL (`/api/payments/webhook`), catatan user premium Mayar eksisting tetap aktif sampai `premium_until`
- [x] 5.3 Update `render.yaml` — ganti blok env Mayar dengan blok env DOKU
- [x] 5.4 Update komentar payment di `backend/src/routes.ts` (Mayar.id → DOKU)

## 6. Frontend UI

- [x] 6.1 `app/pricing/page.tsx` — ganti teks "Mayar.id"/"Ke Mayar…" → DOKU (label pembayaran: QRIS, e-wallet, VA, dsb.); alur checkout & `?upgrade=success` tetap
- [x] 6.2 `components/KemerdekaanPopup.tsx` — ganti teks "Mengarahkan ke Mayar…" → DOKU
- [x] 6.3 `components/PremiumSuccessPopup.tsx` — update komentar & label Mayar → DOKU (logika query `?upgrade=success` tetap)

## 7. Verifikasi & Uji

- [x] 7.1 Typecheck & build: `npx tsc --noEmit` (root & backend) bersih; tidak ada referensi `mayar` tersisa di kode/env/UI (`grep -ri mayar` hanya boleh di arsip openspec/migration backup)
- [x] 7.2 Uji sandbox DOKU: `createCheckoutPayment` → URL checkout asli dari DOKU sandbox ✅; webhook E2E via `backend/scripts/webhook-e2e.ts` — SUCCESS → premium aktif 30 hari ✅, duplikat diabaikan ✅, signature salah → 401 ✅, PENDING tanpa aktivasi ✅, invoice+email tak dikenal → matched:false ✅, fallback email ✅, cleanup ✅ (11/11 lulus)
- [x] 7.3 Verifikasi logika premium via `backend/scripts/logic-e2e.ts`: status non-premium → trial 7 hari sekali seumur hidup (duplikat 409) ✅, cancel (409 saat non-premium) ✅, diskon 15% → 50150 ✅, kode tak dikenal → error ✅, `used_count` bertambah ✅, cleanup ✅ (11/11 lulus setelah RPC patch 008 dijalankan user)
- [ ] 7.4 Update `openspec/specs` — setelah apply: hapus `openspec/specs/mayar-subscription/spec.md`, buat `openspec/specs/doku-payments/spec.md` (via sync/archive workflow)
