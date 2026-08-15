## 1. Klien Pakasir

- [x] 1.1 Buat `lib/pakasir.ts` — `isPakasirConfigured()`, `buildPayUrl({amount, orderId, redirectUrl})` (encode `redirect`), `verifyTransactionDetail({orderId, amount})` (GET `transactiondetail` dengan `PAKASIR_API_KEY`, timeout 10 dtk)
- [x] 1.2 Hapus `lib/doku.ts` (signature, sanitize, createCheckoutPayment tidak lagi dipakai)

## 2. Route checkout & webhook

- [x] 2.1 Rewrite `app/api/payments/checkout/route.ts` — validasi tier + diskon → catat `pakasir_payment_requests` (order_id → user + tier + amount final) → `buildPayUrl` dengan redirect netral `?upgrade=done` → return `{ link, transactionId, amount, discount }`; ganti `isDokuConfigured` → `isPakasirConfigured`
- [x] 2.2 Rewrite `app/api/payments/webhook/route.ts` — parse payload Pakasir `{amount, order_id, project, status, payment_method, completed_at}`; verifikasi fail-closed: `project` cocok → order_id+amount tercatat → konfirmasi `transactiondetail` status `completed` → aktivasi premium 30 hari + tier; idempotensi via `pakasir_notification_events`; `transactiondetail` error → 5xx tanpa aktivasi; status ≠ completed → 200 tanpa aktivasi
- [x] 2.3 Pastikan `status`/`trial`/`cancel` route tetap berfungsi tanpa perubahan

## 3. Migrasi database

- [x] 3.1 Buat `supabase_patch_010_pakasir_payments.sql` — drop tabel `doku_payment_requests`/`doku_notification_events` & kolom `users.doku_*`; buat `pakasir_payment_requests` (order_id unique, user_id, tier, amount, status, paid_at), `pakasir_notification_events` (order_id unique, payload, status), kolom `users.pakasir_invoice_number`/`pakasir_transaction_id`
- [x] 3.2 (Perlu akses Supabase) Backup dulu, lalu jalankan patch 010 di SQL Editor

## 4. Env & dokumentasi

- [x] 4.1 Update `.env.example` (root & `backend/`) — hapus `DOKU_*`, tambah `PAKASIR_PROJECT`, `PAKASIR_API_KEY`, `PAKASIR_REDIRECT_URL`
- [x] 4.2 Update nilai lokal root & `backend/.env.local` (hapus `DOKU_*`, isi `PAKASIR_*`)
- [x] 4.3 Update `SUPABASE_SETUP_GUIDE.md` & `render.yaml` (env DOKU → Pakasir, Webhook URL)
- [x] 4.4 Update komentar referensi DOKU di `backend/src/routes.ts` (bila ada)

## 5. Frontend UI

- [x] 5.1 Ganti label/teks "DOKU" → "Pakasir" di `app/pricing/page.tsx` & `components/KemerdekaanPopup.tsx`
- [x] 5.2 Update komentar referensi DOKU di `components/PremiumSuccessPopup.tsx` (logika polling `?upgrade=done` tetap)
- [x] 5.3 Pastikan badge `plan-badge` & sidebar tidak menyebut DOKU

## 6. Skrip tes

- [x] 6.1 Buat `backend/scripts/test-pakasir.ts` — format URL `buildPayUrl`, verifikasi `transactiondetail` vs sandbox; hapus `test-doku.ts`
- [x] 6.2 Adaptasi `webhook-e2e.ts`, `live-flow-e2e.ts`, `simulate-payment.ts`, `check-db.ts` ke tabel/payload Pakasir (ganti `doku_*` → `pakasir_*`)

## 7. Verifikasi & penyelesaian

- [x] 7.1 Typecheck root & backend (`tsc --noEmit`) + `grep -i doku` di kode/env/UI kosong
- [x] 7.2 Uji sandbox Pakasir: checkout → hosted page → `paymentsimulation` → webhook → premium 30 hari; status bukan completed → tanpa aktivasi; duplikat → 200 tanpa reset
- [ ] 7.3 Sync/archive specs (`pakasir-payments` ADDED, `doku-payments` REMOVED/retire) via `/openspec-archive-change`
