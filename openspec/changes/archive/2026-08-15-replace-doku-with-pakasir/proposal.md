## Why

Pengguna meminta penggantian total payment gateway dari DOKU ke **Pakasir** (app.pakasir.com) dan menghapus semua jejak DOKU sampai tidak tersisa. Pakasir adalah payment gateway Indonesia (QRIS + Virtual Account) dengan model proyek berbasis `slug` + `api_key`, hosted payment page, dan webhook tanpa signature (verifikasi dianjurkan via API `transactiondetail`).

## What Changes

- **BREAKING (gateway):** seluruh integrasi DOKU diganti Pakasir — `lib/doku.ts` dihapus dan diganti `lib/pakasir.ts`; checkout route membuat URL hosted payment page Pakasir (`https://app.pakasir.com/pay/{slug}/{amount}?order_id=...&redirect=...`); webhook route memproses payload Pakasir `{amount, order_id, project, status, payment_method, completed_at}`.
- **Verifikasi webhook fail-closed (tanpa HMAC):** verifikasi `project` == slug, `order_id` tercatat di `pakasir_payment_requests` dengan amount konsisten, lalu konfirmasi authoritative via `GET /api/transactiondetail` (status harus `completed`) sebelum mengaktifkan premium 30 hari; idempotensi via `pakasir_notification_events` (unique `order_id`); bila verifikasi gagal/tak terjangkau → tanpa aktivasi.
- **Model bisnis tidak berubah:** 1x bayar = 30 hari premium, tier promo Rp 5.000 / normal Rp 59.000, kode diskon, trial 7 hari, gating premium, alur redirect netral `?upgrade=done` + polling status (popup sukses hanya saat premium terkonfirmasi).
- **Database:** drop tabel `doku_payment_requests` & `doku_notification_events` serta kolom `users.doku_*`; buat `pakasir_payment_requests`, `pakasir_notification_events`, dan kolom `users.pakasir_*` (migration patch 010).
- **Env & docs:** hapus `DOKU_*`, tambah `PAKASIR_PROJECT`, `PAKASIR_API_KEY`, `PAKASIR_REDIRECT_URL`; update `.env.example`, `SUPABASE_SETUP_GUIDE.md`, `render.yaml`, `backend/.env.example`, `.env.local`, dan skrip tes.
- **UI:** label "DOKU" di `/pricing`, `KemerdekaanPopup`, komentar `PremiumSuccessPopup` diganti Pakasir; badge `plan-badge` tidak berubah (gateway-agnostic).

## Capabilities

### New Capabilities
- `pakasir-payments`: checkout langganan via Pakasir (hosted payment page), menerima & memverifikasi webhook Pakasir (fail-closed + transactiondetail), aktivasi premium 30 hari per pembayaran sukses, penghapusan seluruh jejak DOKU.

### Modified Capabilities
- `doku-payments`: seluruh requirement dihapus (diganti `pakasir-payments`) — capability di-retire.

## Impact

- **Frontend:** `app/pricing/page.tsx`, `components/KemerdekaanPopup.tsx`, `components/PremiumSuccessPopup.tsx` (label/komentar), `components/layout/Sidebar.tsx` & `PlanBadge` tetap (tidak berubah).
- **Backend:** `app/api/payments/checkout/route.ts`, `app/api/payments/webhook/route.ts`; `lib/doku.ts` dihapus, `lib/pakasir.ts` baru; `app/api/payments/status|trial|cancel` tidak berubah.
- **Database:** `supabase_patch_010_pakasir_payments.sql` (drop DOKU, buat Pakasir).
- **Env/docs:** `.env.example`, `SUPABASE_SETUP_GUIDE.md`, `render.yaml`, `backend/.env.example`, root & `backend/.env.local`, `backend/scripts/*` (test-doku → test-pakasir, webhook-e2e, live-flow-e2e, simulate-payment).
- **Terkait change sebelumnya:** `replace-mayar-with-doku` & `fix-doku-redirect-and-plan-badge` sudah di-archive; main spec `doku-payments` di-retire oleh change ini.
