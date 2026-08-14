## Why

Eureka.AI saat ini menjual "Pro" hanya sebagai simulasi client-side (`localStorage.setItem("eureka_plan", ...)` di `/pricing`) — tidak ada pembayaran nyata, tidak ada status premium di database, dan tidak ada fitur yang diblokir untuk user gratis. Developer menanggung biaya AI (chat asisten, generate catatan, web search, gambar) tanpa ada pendapatan. Perlu integrasi payment gateway nyata agar proyek menghasilkan uang: langganan otomatis via **Mayar.id** (Membership SaaS, license-based) dengan dua tier harga (Promo Rp 5.000 & Normal Rp 59.000), webhook untuk aktivasi/ekspirasi, dan gating fitur premium server-side.

## What Changes

- **Checkout Mayar**: tombol "Aktifkan Pro" di `/pricing` & popup kemerdekaan → buat transaksi via Mayar API (`POST /hl/v1/payment/create`) dengan amount sesuai tier yang dipilih (promo/normal) → redirect user ke link checkout Mayar.
- **Webhook Mayar**: endpoint baru `POST /api/payments/webhook` yang menerima event `payment.received` & event membership (`membership.newMemberRegistered`, `membership.memberExpired`, `membership.memberUnsubscribed`, `membership.changeTierMemberRegistered`) → aktivasi/penonaktifan status premium.
- **Persistensi premium**: kolom baru di tabel `users` (atau tabel `subscriptions` baru) — `is_premium`, `premium_until`, `mayar_license_code`, `mayar_product_id`, tier aktif. Sinkron status via verifikasi lisensi ke Mayar saat login/akses.
- **Gating fitur premium** (usulan — bisa disesuaikan): fitur berbiaya tinggi dibatasi untuk free user, unlimited untuk premium:
  - Chat asisten AI (`/api/assistant/chat`): kuota harian terbatas untuk free (mis. 10 pesan/hari), unlimited untuk premium.
  - Generate catatan AI (`/api/notes/process`): kuota bulanan terbatas untuk free (mis. 3 catatan/bulan), unlimited premium.
  - Web search (`webSearch: true`): hanya premium.
  - Generate gambar AI (`/api/assistant/image`): hanya premium.
  - Flashcards/kuis AI & enrichment bab: kuota terbatas free, unlimited premium.
- **UI status premium**: badge "Pro" di sidebar, halaman `/pricing` menampilkan status aktif (bukan tombol beli lagi), state premium di-load dari server (bukan localStorage).
- **Env baru**: `MAYAR_API_KEY`, `MAYAR_PRODUCT_ID_PROMO`, `MAYAR_PRODUCT_ID_NORMAL`, `MAYAR_WEBHOOK_SECRET` (bila ada), `MAYAR_REDIRECT_URL`.

## Capabilities

### New Capabilities

- `mayar-subscription`: Integrasi langganan Mayar.id — membuat checkout, menerima webhook pembayaran/keanggotaan, mempersistensikan status premium per user, dan menerapkan gating fitur premium server-side pada route AI.

### Modified Capabilities

<!-- Tidak ada spec lama yang berubah; perubahan pricing/gating adalah perilaku baru. -->

## Impact

- **API baru**: `app/api/payments/checkout/route.ts` (buat transaksi Mayar), `app/api/payments/webhook/route.ts` (terima callback Mayar, verifikasi & update premium), `app/api/payments/status/route.ts` (baca status premium user).
- **Backend**: daftar route di `backend/src/routes.ts` (+3 mount), `lib/mayar.ts` baru (client API Mayar), `lib/premium.ts` baru (cek/gating premium), Supabase migration `supabase_patch_007_mayar_subscription.sql`.
- **Frontend**: `app/pricing/page.tsx`, `components/KemerdekaanPopup.tsx`, `components/layout/Sidebar.tsx` (badge Pro), komponen status pembayaran/halaman sukses.
- **Route AI yang di-gate**: `app/api/assistant/chat/route.ts`, `app/api/notes/process/route.ts`, `app/api/assistant/image/route.ts`, `app/api/assistant/quiz/route.ts`, `app/api/assistant/flashcards/route.ts`, `app/api/notes/[id]/bab/.../regenerate/route.ts`.
- **Dependensi**: tidak ada package baru di frontend/backend (pakai `fetch` native + Supabase yang sudah ada).
- **Konfigurasi**: `.env.local` + env produksi VPS (variabel `MAYAR_*`).
- **Eksternal**: akun Mayar.id (API key dari `web.mayar.id/api-keys`), 2 produk Membership SaaS di dashboard Mayar (promo & normal), URL webhook didaftarkan via `POST /hl/v1/webhook/register` atau dashboard.
