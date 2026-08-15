## Context

Alur langganan DOKU sudah berfungsi (checkout → webhook → premium 30 hari, lihat change `replace-mayar-with-doku`). Saat ini `DOKU_REDIRECT_URL` di-hardcode `?upgrade=success`, dan `components/PremiumSuccessPopup.tsx` memunculkan popup sukses hanya dari query tersebut — padahal DOKU mengarahkan customer kembali ke `callback_url` apa pun hasilnya (dikonfirmasi di docs Checkout Settings: "Custom Result Page URL ... specify callbacks.url"). Aktivasi premium bersifat asinkron via webhook, sehingga status saat user kembali belum tentu premium. Tidak ada penanda visual Free vs Pro selain item nav "Pro Aktif ✓ / Tingkatkan Pro" di sidebar.

Motivasi lengkap: lihat proposal.md — Why.

## Goals / Non-Goals

**Goals:**
- Redirect URL netral (tidak mengklaim hasil pembayaran) — `?upgrade=done`.
- Popup sukses hanya muncul bila server mengonfirmasi premium aktif (verifikasi + polling singkat ±15 dtk).
- Notifikasi netral saat pembayaran batal/gagal/timeout — tanpa klaim sukses.
- Badge status paket (Pro/Trial/Free) di sidebar (chip user) dan halaman Profil.

**Non-Goals:**
- Tidak mengubah webhook DOKU, endpoint status, atau skema database.
- Tidak menambahkan halaman hasil pembayaran terpisah.
- Tidak mengubah alur trial/diskon/cancel.

## Decisions

### 1. Redirect URL netral `?upgrade=done`
Ubah nilai redirect default dari `?upgrade=success` → `?upgrade=done` di semua tempat: fallback `app/api/payments/checkout/route.ts`, `.env.example`, `SUPABASE_SETUP_GUIDE.md`, `backend/scripts/test-doku.ts`, dan nilai lokal root/`backend/.env.local`.
- **Alternatif**: memetakan hasil dari query param DOKU — ditolak: dokumen DOKU tidak menjamin parameter hasil di redirect, dan verifikasi server-side (fail-closed) lebih andal.

### 2. Verifikasi status premium saat kembali (di `PremiumSuccessPopup`)
Perluas komponen popup yang sudah ter-mount di root layout:
- Trigger baru: `searchParams.get("upgrade") === "done"`.
- Saat trigger: panggil `GET /api/payments/status` (via `usePremium().refresh()` atau `apiFetch` langsung) setiap ±2,5 dtk, maksimal 6× (±15 dtk).
- Bila status premium aktif → tampilkan popup sukses (UI eksisting).
- Bila timeout tanpa premium → tampilkan notifikasi netral kecil (toast) "Pembayaran belum selesai — kamu masih di paket Free", tanpa popup sukses.
- Bersihkan query `upgrade` dari URL di kedua kasus (pola `router.replace` yang sudah ada).
- Tetap StrictMode-safe: `handled.current` di-set di dalam callback timer (pola yang sudah diperbaiki di change sebelumnya).
- **Alternatif**: halaman `/payment/result` terpisah — lebih banyak komponen & routing untuk manfaat yang sama; popup eksisting lebih minimal.

### 3. Komponen `components/PlanBadge.tsx` (client)
- Memakai `usePremium()` (server-sourced): tier `normal`/`promo` → badge `Pro` (emas + ikon Crown), tier `trial` → `Trial` (ungu), non-premium → `Free` (abu-abu).
- Prop opsional `size` ("sm" | "md") agar pas di chip sidebar vs header Profil.
- Dipasang di:
  - `components/layout/Sidebar.tsx` — chip user (di samping nama); item nav "Pro Aktif ✓ / Tingkatkan Pro" tetap dipertahankan sebagai CTA.
  - `app/dashboard/profil/page.tsx` — di dekat nama/header profil.

### 4. Tanpa perubahan backend endpoint
`GET /api/payments/status` sudah ada dan fail-closed; polling memakai endpoint yang sama.

## Risks / Trade-offs

- [Webhook DOKU tidak pernah sampai (mis. localhost, atau Notification URL salah)] → Polling timeout → notifikasi netral jujur "belum selesai"; tidak ada klaim sukses palsu. Di produksi, verifikasi webhook sudah teruji E2E.
- [User refresh/tinggalkan halaman saat polling berjalan] → Popup terlewat; tidak fatal (status terlihat lewat badge), polling dihentikan saat unmount.
- [React StrictMode dev menjalankan effect dua kali] → `handled` di-set di dalam timer callback (pola eksisting).
- [Perubahan nilai env `DOKU_REDIRECT_URL` adalah breaking untuk konfigurasi lama] → Fallback kode memakai `?upgrade=done` bila env kosong; docs diperbarui.
- [Polling menambah request saat webhook lambat] → Terbatas (±6 request dalam 15 dtk, hanya saat kembali dari DOKU), aman.

## Migration Plan

1. Terapkan perubahan kode (checkout fallback, popup, badge, env docs).
2. Perbarui nilai `DOKU_REDIRECT_URL` di env lokal & dashboard hosting (Vercel/Render) menjadi `https://<domain>/dashboard?upgrade=done`.
3. Tidak ada perubahan database — rollback cukup mengembalikan nilai redirect & logika popup.

## Open Questions

- Apakah DOKU menambahkan parameter hasil (mis. `result=...`) pada redirect — tidak diperlukan karena verifikasi dilakukan server-side (fail-closed); dijawab nanti saat uji sandbox tanpa mengubah pendekatan.
