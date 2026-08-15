## Why

Tiga masalah di alur langganan DOKU yang baru diimplementasikan:

1. **Redirect URL mengklaim sukses secara salah.** `DOKU_REDIRECT_URL` di-hardcode menjadi `?upgrade=success`, padahal DOKU mengarahkan user kembali ke `callback_url` apa pun hasilnya (sukses, batal, gagal, kedaluwarsa). Akibatnya user yang **membatalkan** pembayaran tetap diarahkan ke `/dashboard?upgrade=success` dan melihat popup "Selamat! Kamu Berhasil Berlangganan" — klaim yang tidak benar.
2. **Premium belum aktif saat user kembali.** Aktivasi premium bersifat asinkron: hanya terjadi saat webhook DOKU diproses (fail-closed by design). User kembali ke `/dashboard` sebelum webhook tiba (atau webhook tidak pernah sampai, mis. di localhost) sehingga tetap terlihat "belum premium" tanpa umpan balik yang jujur.
3. **Tidak ada penanda visual status paket.** Tidak ada badge yang menunjukkan status Free vs Pro di antarmuka, sehingga user tidak tahu status paketnya sekilas.

## What Changes

- **BREAKING (URL callback):** redirect URL checkout diubah dari `?upgrade=success` menjadi **netral** `?upgrade=done` — tidak lagi mengklaim hasil pembayaran di URL. Berlaku di env `DOKU_REDIRECT_URL`, fallback `app/api/payments/checkout/route.ts`, dokumentasi, dan skrip tes.
- **Popup sukses berbasis fakta server:** popup "Berhasil Berlangganan" hanya muncul setelah server mengonfirmasi premium aktif (`GET /api/payments/status`), bukan dari query string. Saat kembali dari DOKU dengan `?upgrade=done`, frontend memverifikasi status premium dan melakukan polling singkat (±15 detik) untuk memberi waktu webhook DOKU memproses pembayaran.
- **Notifikasi netral saat pembayaran tidak selesai:** jika verifikasi gagal (dibatalkan/digagalkan/timeout), sistem menampilkan notifikasi netral "Pembayaran belum selesai — kamu masih di paket Free" tanpa klaim sukses, lalu membersihkan query.
- **Badge status paket:** komponen badge baru menampilkan `Pro` (emas + mahkota), `Trial` (ungu), atau `Free` (abu-abu) di sidebar (chip nama user) dan halaman Profil, berdasarkan status premium dari server.
- Env & dokumentasi disesuaikan dengan default redirect baru.

## Capabilities

### New Capabilities
- `plan-badge`: menampilkan badge status paket user (Pro / Trial / Free) di sidebar dan halaman Profil, bersumber dari status premium server (`GET /api/payments/status`).

### Modified Capabilities
- `doku-payments`: alur kembali dari halaman pembayaran DOKU — redirect netral `?upgrade=done`, verifikasi + polling status premium sebelum menampilkan popup sukses, dan notifikasi netral saat pembayaran tidak selesai.

## Impact

- **Frontend:** `components/PremiumSuccessPopup.tsx` (logika return: verifikasi & polling, popup sukses hanya bila premium terkonfirmasi, notifikasi netral), `components/layout/Sidebar.tsx` (badge di chip user), `app/dashboard/profil/page.tsx` (badge), komponen baru `components/PlanBadge.tsx`.
- **Backend:** `app/api/payments/checkout/route.ts` (fallback redirect URL netral). Tidak ada perubahan endpoint, webhook, atau database.
- **Env & docs:** `.env.example`, `SUPABASE_SETUP_GUIDE.md`, nilai lokal `backend/.env.local` & root `.env.local`, `backend/scripts/test-doku.ts` (redirectUrl tes).
- **Ketergantungan:** change ini berdiri di atas `replace-mayar-with-doku` (delta `doku-payments` di main specs belum disync sampai change itu di-archive) — perlu di-archive lebih dulu agar sync delta `MODIFIED` ini berjalan mulus.
