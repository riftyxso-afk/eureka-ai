## Context

Saat ini langganan Pro Eureka.AI terintegrasi dengan Mayar.id secara license-based: `lib/mayar.ts` (createPayment, verifyLicense, deactivateLicense, registerWebhook), webhook Mayar (`payment.received`, `membership.*`) dengan verifikasi merchantId + webhook token, kolom DB `mayar_license_code`/`mayar_product_id`/`mayar_customer_id`, tabel audit `mayar_webhook_events`, env `MAYAR_*`, dan label UI "Mayar.id". Detail motivasi: lihat proposal.md — Why.

DOKU berbeda fundamental dari Mayar: DOKU adalah payment gateway one-time (bukan SaaS membership). Setelah diskusi, model renewal yang dipilih adalah **1x bayar = premium aktif 30 hari** (tanpa auto-renew, tanpa lisensi). Dua tier (promo Rp 5.000, normal Rp 59.000), kode diskon, trial 7 hari, dan gating premium server-side dipertahankan.

## Goals / Non-Goals

**Goals:**
- Mengganti seluruh backend pembayaran dari Mayar.id ke DOKU Checkout dengan perubahan minimal pada alur user (checkout → halaman bayar DOKU → redirect balik → popup sukses).
- Verifikasi HTTP Notification DOKU secara kriptografis (HMAC-SHA256) — fail-closed.
- Menghapus semua jejak Mayar (kode, env, DB, UI, dokumentasi).
- Tetap memakai `fetch` + `crypto` bawaan Node.js — tanpa library pihak ketiga baru.

**Non-Goals:**
- Auto-renew / recurring payment DOKU (SNAP tokenisasi kartu) — di luar scope, model one-time dipilih.
- Refund flow otomatis — pembatalan hanya menonaktifkan premium (tanpa refund), sama seperti saat ini.
- Migrasi data lisensi Mayar lama ke DOKU — lisensi Mayar dihapus; user premium eksisting tetap aktif hingga `premium_until` mereka habis.

## Decisions

### D1. Pakai DOKU Checkout API (non-SNAP) — bukan SNAP
Gunakan `POST /checkout/v1/payment` (hosted payment page) karena paling setara dengan alur Mayar saat ini: backend membuat transaksi, user di-redirect ke halaman pembayaran DOKU yang mendukung banyak channel (QRIS, e-wallet, VA, kartu), lalu DOKU mengirim notifikasi + redirect balik via `callback_url`.
- Endpoint: sandbox `https://api-sandbox.doku.com/checkout/v1/payment`, prod `https://api.doku.com/checkout/v1/payment` (dipilih via `DOKU_SANDBOX`).
- Header: `Client-Id`, `Request-Id` (uuid unik per request), `Request-Timestamp` (ISO8601 UTC), `Signature`.
- Body minimal: `order.amount`, `order.invoice_number`, `order.currency: "IDR"`, `order.callback_url`, `order.auto_redirect: true`, `payment.payment_due_date` (mis. 1440 menit), `customer.name`, `customer.email`, `customer.id` (userId).
- Respons: `response.payment.url` (link redirect user), `response.payment.token_id`, `response.order.session_id`.
- Alternatif yang ditolak: SNAP (lebih kompleks, butuh B2B token, dipakai untuk recurring/tokenisasi — tidak diperlukan untuk model one-time).

### D2. Signature request & verifikasi notifikasi (HMAC-SHA256)
Komponen string-to-sign untuk method POST (dipisah newline, tanpa newline di akhir):
```
Client-Id:{clientId}
Request-Id:{requestId}
Request-Timestamp:{timestamp}
Request-Target:{path}
Digest:{base64(sha256(rawBody))}
```
- Signature = `HMACSHA256=` + base64(HMAC-SHA256(stringToSign, DOKU_SECRET_KEY)).
- Untuk request checkout: `Request-Target = /checkout/v1/payment`, Digest dari body JSON yang dikirim.
- Untuk verifikasi notifikasi masuk: `Request-Target = path notifikasi` (mis. `/api/payments/webhook`), Digest dari **raw body** persis seperti diterima, lalu bandingkan dengan header `Signature` (constant-time compare). Gagal → 401, jangan proses.
- Satu helper dipakai dua arah (`lib/doku.ts`), memakai `node:crypto` (`createHmac`, `createHash`).

### D3. `invoice_number` unik & aman sebagai kunci idempotensi
- Format: alfanumerik tanpa simbol (batasan KKI), panjang ≤ 30 karakter (aman untuk channel kartu kredit yang membatasi 30): `EKA{YYYYMMDDHHmmss}{4 random}` (mis. `EKA2026081510301248x9`).
- Disimpan di `users.doku_invoice_number` dan menjadi kunci UNIQUE tabel `doku_notification_events` untuk idempotensi (pengganti `transaction_id` Mayar).
- Alternatif yang ditolak: `crypto.randomUUID()` murni — valid, tapi invoice lebih mudah dilacak saat support/audit dengan prefix tanggal.

### D4. Webhook ditulis ulang — DOKU HTTP Notification
Alur baru `app/api/payments/webhook/route.ts`:
1. **Verifikasi (fail-closed)**: baca raw body (`req.text()`) → hitung signature dari header (`Client-Id`, `Request-Id`, `Request-Timestamp`, `Signature`) + path (`/api/payments/webhook`) + digest body → tidak cocok = 401. Bila `DOKU_SECRET_KEY` belum di-set → tolak semua (503), jangan pernah proses tanpa verifikasi.
2. **Idempotensi**: insert ke `doku_notification_events` (UNIQUE `invoice_number`) — duplikat → 200 tanpa aksi.
3. **Proses**: bila status transaksi = sukses (`transaction.status === "SUCCESS"` pada payload non-SNAP) → cari **`doku_payment_requests` by `invoice_number`** (membawa `user_id`, `tier`, `amount` — jadi tier benar walau harga sudah dipotong diskon; verifikasi amount konsisten), fallback cari user by `customer.email` (case-insensitive) + tier dari amount (5000 → promo, 59000 → normal) → `is_premium=true`, `premium_until = now + 30 hari`, `premium_tier`, simpan `doku_invoice_number`/`doku_transaction_id`; tandai payment request `paid`. Status lain (pending/gagal/refund/batal) → 200 tanpa aktivasi.
4. Selalu balas 200 kecuali 401/503, agar DOKU tidak retry tanpa perlu.

Alasan pencocokan via invoice: amount setelah diskon (mis. Rp 4.250) tidak bisa dipetakan ke tier hanya dari angka, dan email pembayar bisa berbeda dari email akun — tabel `doku_payment_requests` menutup kedua celah ini.

### D5. Hapus model lisensi dari `lib/premium.ts`
- Hapus import & pemakaian `verifyLicense` (termasuk blok verifikasi < 12 jam sebelum kedaluwarsa) dan `deactivateLicense`.
- `getPremiumStatus`: seleksi kolom tanpa `mayar_license_code`/`mayar_product_id`; respons tanpa field `licenseCode`.
- `cancelSubscription`: hapus panggilan deaktivasi lisensi; cukup `UPDATE users SET is_premium = false`.
- Kedaluwarsa premium murni dari `premium_until`.

### D6. Migrasi DB `supabase_patch_009_doku_payments.sql`
- `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS doku_invoice_number TEXT, doku_transaction_id TEXT;` (+ index parsial pada `doku_invoice_number`).
- `CREATE TABLE public.doku_payment_requests (id UUID PK, user_id FK → users, invoice_number TEXT UNIQUE NOT NULL, amount BIGINT, tier TEXT, status TEXT DEFAULT 'pending', paid_at TIMESTAMPTZ, created_at)` — dicatat saat checkout dibuat (SEBELUM memanggil DOKU) agar webhook bisa mencocokkan invoice → user + tier.
- `CREATE TABLE public.doku_notification_events (id UUID PK, invoice_number TEXT UNIQUE, status TEXT, amount BIGINT, payload JSONB, matched_user_id, processed_at, created_at DEFAULT now());` + RLS service_role (pola sama dengan `mayar_webhook_events`).
- Hapus jejak Mayar: `DROP TABLE IF EXISTS public.mayar_webhook_events;` dan `ALTER TABLE public.users DROP COLUMN IF EXISTS mayar_license_code, DROP COLUMN IF EXISTS mayar_product_id, DROP COLUMN IF EXISTS mayar_customer_id;` (⚠️ backup dulu).
- Kolom premium (`is_premium`, `premium_until`, `premium_tier`, `trial_claimed_at`) tetap.

### D7. Env & dokumentasi
- Tambah: `DOKU_CLIENT_ID`, `DOKU_SECRET_KEY`, `DOKU_SANDBOX`, `DOKU_REDIRECT_URL` (callback balik aplikasi, fallback `${origin}/dashboard?upgrade=success`).
- Hapus: `MAYAR_API_KEY`, `MAYAR_WEBHOOK_TOKEN`, `MAYAR_MERCHANT_ID`, `MAYAR_PRODUCT_ID_PROMO`, `MAYAR_PRODUCT_ID_NORMAL`, `MAYAR_REDIRECT_URL`, `MAYAR_SANDBOX` dari `.env.example`, `SUPABASE_SETUP_GUIDE.md`, `render.yaml`.

### D8. Frontend — perubahan kosmetik + tipe
- `lib/usePremium.ts`: hapus field `licenseCode` dari tipe `PremiumStatus` dan normalisasi data.
- `app/pricing/page.tsx`, `components/KemerdekaanPopup.tsx`, `components/PremiumSuccessPopup.tsx`: teks "Mayar.id"/"Ke Mayar…" → DOKU. Alur `?upgrade=success` tetap (via `order.callback_url`).

## Risks / Trade-offs

- **Format payload notifikasi non-SNAP tidak terdokumentasi persis di dokumen publik** (field `transaction.status`, `order.invoice_number`, `customer.email` diperkirakan mengikuti pola Jokul non-SNAP) → Mitigasi: parse lenient (non-strict, beberapa kemungkinan field), selalu simpan raw payload untuk audit, dan verifikasi pakai DOKU payment simulator sandbox sebelum go-live.
- **User premium Mayar eksisting**: lisensi tidak lagi diverifikasi; mereka tetap premium hingga `premium_until` habis, lalu harus bayar ulang via DOKU → Mitigasi: dokumentasikan di SUPABASE_SETUP_GUIDE; tidak ada data pengguna yang dihapus (hanya kolom `mayar_*`).
- **Invoice number > 30 char / mengandung simbol** → ditolak channel kartu/KKI → Mitigasi: format D3 (≤ 30, alfanumerik).
- **Clock skew pada `Request-Timestamp`** bisa membuat signature request DOKU ditolak → Mitigasi: selalu generate timestamp saat request dibuat (bukan dari client), format ISO8601 UTC.
- **Kesalahan konfigurasi DOKU (Client ID/Secret salah)** → seluruh checkout gagal → Mitigasi: helper `isDokuConfigured()` memberi pesan 503 yang jelas; uji sandbox dulu.

## Migration Plan

1. Jalankan `supabase_patch_009_doku_payments.sql` di Supabase (tambah kolom DOKU + tabel notifikasi, drop tabel/kolom Mayar).
2. Ganti kode: `lib/doku.ts` baru → rewrite `checkout` & `webhook` → bersihkan `lib/premium.ts`, `lib/usePremium.ts`, UI, docs, env, `render.yaml` → hapus `lib/mayar.ts`.
3. Buat akun DOKU (sandbox) → ambil Client ID & Secret Key → isi `DOKU_*` di `.env.local` → daftarkan Notification URL (`https://<host>/api/payments/webhook`) di DOKU Back Office.
4. Uji sandbox end-to-end: checkout → bayar via simulator → notifikasi SUCCESS → premium aktif di DB; duplikat diabaikan; signature salah → 401.
5. Rollback: git revert kode; migration 009 bisa dibalik manual (buat ulang tabel/kolom Mayar bila perlu) — kolom `mayar_*` di-backup via dump sebelum drop.

## Open Questions

- Nama field persis payload notifikasi non-SNAP DOKU (perlu dikonfirmasi saat uji simulator sandbox; parse dirancang lenient). Tidak mengubah spec/approach — hanya detail parsing.
- Apakah `order.callback_url` DOKU menerima query string (`?upgrade=success`) pada semua channel — asumsi ya; fallback tetap popup sukses berbasis query di sisi frontend.
