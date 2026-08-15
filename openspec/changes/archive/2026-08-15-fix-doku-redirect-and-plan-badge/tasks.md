## 1. Redirect URL netral

- [x] 1.1 Ubah fallback redirect URL di `app/api/payments/checkout/route.ts` dari `?upgrade=success` → `?upgrade=done`
- [x] 1.2 Update `.env.example` & `SUPABASE_SETUP_GUIDE.md` (deskripsi `DOKU_REDIRECT_URL` → default netral `?upgrade=done`)
- [x] 1.3 Update nilai lokal `backend/.env.local` & root `.env.local` (`DOKU_REDIRECT_URL`)
- [x] 1.4 Update `backend/scripts/test-doku.ts` (redirectUrl tes → `?upgrade=done`)

## 2. Verifikasi status premium saat kembali dari DOKU

- [x] 2.1 Perluas `components/PremiumSuccessPopup.tsx`: trigger baru `?upgrade=done` + polling status premium via `GET /api/payments/status` (±2,5 dtk × 6 ≈ 15 dtk)
- [x] 2.2 Tampilkan popup sukses HANYA saat server mengonfirmasi premium aktif; bersihkan query `upgrade` dari URL
- [x] 2.3 Tampilkan notifikasi netral (toast) "Pembayaran belum selesai — kamu masih di paket Free" saat timeout/tidak premium, tanpa popup sukses
- [x] 2.4 Pastikan StrictMode-safe (`handled` di-set dalam callback timer) & polling dihentikan saat unmount

## 3. Badge status paket (Pro/Trial/Free)

- [x] 3.1 Buat komponen baru `components/PlanBadge.tsx` berbasis `usePremium()` — `Pro` (emas + ikon Crown) untuk tier normal/promo, `Trial` (ungu) untuk trial, `Free` (abu-abu) untuk non-premium
- [x] 3.2 Pasang badge di `components/layout/Sidebar.tsx` (chip nama user)
- [x] 3.3 Pasang badge di `app/dashboard/profil/page.tsx` (header profil)

## 4. Verifikasi & penyelesaian

- [x] 4.1 Typecheck root & backend (`tsc --noEmit`) + `grep` sisa `upgrade=success` di kode/env/UI
- [ ] 4.2 Uji alur sandbox: checkout → bayar sukses → popup sukses hanya saat premium aktif; checkout → batal/gagal → notifikasi netral tanpa popup sukses (pakai `backend/scripts/simulate-payment.ts` untuk kasus sukses)
- [ ] 4.3 Sync/archive specs (`doku-payments` + `plan-badge`) setelah verifikasi
