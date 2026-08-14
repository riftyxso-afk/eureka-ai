## 1. Database & Konfigurasi

- [x] 1.1 Buat `supabase_patch_007_mayar_subscription.sql` — kolom baru di `public.users` (`is_premium`, `premium_until`, `premium_tier`, `mayar_license_code`, `mayar_product_id`, `mayar_customer_id`) + tabel `mayar_webhook_events` (dengan `transaction_id UNIQUE`) + RLS service_role
- [x] 1.2 Tambah env `MAYAR_API_KEY`, `MAYAR_MERCHANT_ID`, `MAYAR_PRODUCT_ID_PROMO`, `MAYAR_PRODUCT_ID_NORMAL`, `MAYAR_REDIRECT_URL` ke `.env.local` (placeholder) dan dokumentasi (SUPABASE_SETUP_GUIDE.md / README)

## 2. Client Mayar & Helper Premium

- [x] 2.1 Buat `lib/mayar.ts` — client fetch ke Mayar: `createPayment({ name, email, amount, redirectUrl, description })` → link; `verifyLicense({ licenseCode, productId })`; konfigurasi base URL prod/sandbox dari env
- [x] 2.2 Buat `lib/premium.ts` — `getPremiumStatus(userId)`, `assertPremium(userId, feature)`, `enforcePremium(userId, feature)`, verifikasi lisensi berkala (D4), hitung kuota free (chat harian, catatan bulanan, quiz/flashcards harian, bab-regenerate bulanan), respons 402 dengan `upgradeUrl`

## 3. Endpoint API

- [x] 3.1 Buat `app/api/payments/checkout/route.ts` (POST, auth user) — validasi tier promo/normal → `mayar.createPayment` → `{ link }`; error Mayar → 502
- [x] 3.2 Buat `app/api/payments/webhook/route.ts` (POST publik) — validasi `merchantId`, idempotensi via `transactionId`, proses `payment.received` & event membership (aktif/nonaktif), simpan payload audit, balas 200
- [x] 3.3 Buat `app/api/payments/status/route.ts` (GET, auth user) — kembalikan `{ isPremium, tier, premiumUntil }` via `getPremiumStatus`
- [x] 3.4 Mount 3 route baru di `backend/src/routes.ts`

## 4. Gating Route AI

- [x] 4.1 Pasang `enforcePremium` di `app/api/assistant/chat/route.ts` (kuota harian + `webSearch:true` wajib premium)
- [x] 4.2 Pasang di `app/api/notes/process/route.ts` (kuota bulanan generate catatan)
- [x] 4.3 Pasang di `app/api/assistant/image/route.ts` (wajib premium)
- [x] 4.4 Pasang di `app/api/assistant/quiz/route.ts` & `app/api/assistant/flashcards/route.ts` (kuota harian)
- [x] 4.5 Pasang di `app/api/notes/[id]/bab/[chapterId]/regenerate/route.ts` (kuota bulanan enrichment)

## 5. Frontend

- [x] 5.1 Buat hook/helper `lib/usePremium.ts` (atau context) — fetch `/api/payments/status` setelah login, expose `isPremium`/`tier`/`premiumUntil`
- [x] 5.2 Update `app/pricing/page.tsx` — pilih tier (promo/normal) → POST checkout → redirect ke link Mayar; untuk user premium tampilkan status aktif + tanggal kedaluwarsa
- [x] 5.3 Update `components/KemerdekaanPopup.tsx` — tombol "Klaim Promo" → checkout tier promo
- [x] 5.4 Update `components/layout/Sidebar.tsx` — badge "Pro" untuk user premium (item "Tingkatkan Pro" berubah jadi indikator aktif)
- [x] 5.5 Tangani respons 402 di komposer/flow chat & generate catatan — tampilkan notifikasi + tombol ke `/pricing`

## 6. Trial & Diskon

- [x] 6.1 Buat `supabase_patch_008_discount_trial.sql` — kolom `trial_claimed_at` di `users` + tabel `discount_codes` (persen/nominal, max_uses, active, expires_at) + RPC `increment_discount_use`
- [x] 6.2 Buat `lib/discount.ts` — `applyDiscount` (validasi + hitung harga final, minimal Rp 1.000) & `consumeDiscount` (increment atomik)
- [x] 6.3 Tambah `claimTrial` di `lib/premium.ts` (7 hari, sekali seumur hidup, tier `trial`) + route `POST /api/payments/trial` + mount
- [x] 6.4 Update route checkout — terima `discountCode` opsional, hitung harga final, consume kode setelah sukses
- [x] 6.5 Frontend `/pricing` — input kode diskon + tombol "Klaim Trial Gratis" + tampilkan tier trial pada status aktif
- [x] 6.6 Popup selamat berlangganan `PremiumSuccessPopup` — tampil saat kembali dari Mayar dengan `?upgrade=success`, berisi ucapan + daftar benefit, bersihkan query URL setelah ditutup (di-mount di root layout dengan Suspense agar aman prerender)
- [x] 6.7 Batalkan langganan — `lib/mayar.ts` `deactivateLicense` (best-effort), `lib/premium.ts` `cancelSubscription` (nonaktifkan premium segera, tanpa refund), route `POST /api/payments/cancel`, tombol "Batalkan Langganan" di `/pricing` (disembunyikan untuk tier trial) + modal konfirmasi tanpa refund

## 7. Verifikasi & Deploy

- [x] 7.1 Typecheck frontend (`npx tsc --noEmit`) & backend (`cd backend && npx tsc --noEmit`), production build `npm run build`
- [x] 7.2 Uji sandbox Mayar end-to-end: webhook `payment.received` → premium aktif di DB ✅, `memberExpired` → nonaktif ✅, webhook duplikat diabaikan ✅, webhook merchantId salah → 401 ✅ (verifikasi 23/23 tes terhadap Supabase asli; checkout → redirect Mayar menunggu MAYAR_API_KEY asli)
- [x] 7.3 Uji gating & trial & diskon (23/23 lolos): free > kuota → 402 ✅; webSearch free → 402 ✅; claim trial → premium 7 hari tier trial ✅; claim kedua → 409 ✅; kode diskon persen 15% & nominal Rp 10.000 → harga final benar ✅; nominal melebihi harga → minimal Rp 1.000 ✅; kode invalid → error ✅; kuota quiz 2/hari → 402 ✅
- [ ] 7.4 Jalankan migration 007 & 008 di Supabase prod, set env `MAYAR_*` di VPS, daftarkan URL webhook produksi di Mayar, deploy backend (git pull + pm2 restart) & frontend (Vercel), verifikasi endpoint produksi
