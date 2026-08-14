## Context

Lihat proposal.md — Why untuk motivasi. Kondisi saat ini yang membentuk pendekatan:

- Backend adalah Hono (`backend/src/server.ts`) yang memount handler Next.js dari `app/api/**` via `backend/src/utils/honoAdapter.ts`; daftar route di `backend/src/routes.ts`. Jadi endpoint baru cukup ditulis sebagai route Next.js lalu di-mount.
- Auth server-side memakai `lib/assistant/auth.ts` (`authorizeAssistantUser`/`getUserIdFromAuth`) + admin Supabase `lib/supabase/admin.ts` (`db()`); anon client di `lib/supabase/client.ts`.
- Status "Pro" saat ini murni localStorage di `app/pricing/page.tsx` (`eureka_plan`) — tidak ada kolom premium di `public.users`, tidak ada enforcement.
- User memilih model **langganan otomatis (Membership SaaS Mayar)** dengan dua tier harga (Promo Rp 5.000, Normal Rp 59.000) dan meminta fitur-fitur yang wajar di-premium-kan agar dev tidak rugi.
- Mayar API (dari docs.mayar.id): `POST /hl/v1/payment/create` → `{ data: { id, transactionId, link } }`; webhook JSON POST dengan event `payment.received`, `membership.newMemberRegistered`, `membership.memberExpired`, `membership.memberUnsubscribed`, `membership.changeTierMemberRegistered`; verifikasi lisensi `POST /saas/v1/license/verify` (`{ licenseCode, productId }` → `{ isLicenseActive, licenseCode: { expiredAt, ... } }`); register webhook `POST /hl/v1/webhook/register` (`{ urlHook }`).

## Goals / Non-Goals

**Goals:**
- Alur checkout Mayar yang nyata dari `/pricing` & popup kemerdekaan (pilih tier promo/normal → redirect ke link Mayar).
- Webhook Mayar yang memverifikasi event dan memperbarui status premium di DB secara idempoten.
- Status premium persist & enforceable server-side pada route AI berbiaya tinggi.
- UI menampilkan status premium sebenarnya (badge Pro, halaman pricing berubah jadi status aktif untuk yang sudah premium).

**Non-Goals:**
- Menulis ulang auth/onboarding; tidak menambah fitur gating pada fitur non-AI (mis. jumlah catatan yang bisa dibuat manual tanpa AI) kecuali via kuota AI yang disebutkan di proposal.
- Mengelola saldo/payout Mayar, refund, atau dispute — semua ditangani dashboard Mayar.
- Migrasi pengguna "Pro" lama dari localStorage (data itu tidak punya makna server-side; dianggap non-premium).

## Decisions

### D1. Produk & tier: 2 produk Membership SaaS di dashboard Mayar
Buat 2 produk "Membership (SaaS)" di dashboard Mayar — satu tier promo (Rp 5.000, diberi nama jelas mis. "Eureka Pro - Promo Kemerdekaan") dan satu normal (Rp 59.000). `productId` masing-masing disimpan di env (`MAYAR_PRODUCT_ID_PROMO`, `MAYAR_PRODUCT_ID_NORMAL`). Checkout dibuat via `payment/create` dengan `amount` sesuai tier; `redirectUrl` mengarah ke halaman sukses aplikasi.
- *Alternatif ditolak*: satu produk dengan 2 tier (tier dipilih di Mayar) — menambah kompleksitas mapping tier di webhook; dua produk lebih eksplisit dan amount-nya bisa divalidasi di webhook.

### D2. Persistensi: kolom baru di `public.users` + tabel `mayar_webhook_events`
Migration `supabase_patch_007_mayar_subscription.sql`:
- `ALTER TABLE public.users ADD COLUMN is_premium BOOLEAN DEFAULT FALSE`, `premium_until TIMESTAMPTZ`, `premium_tier TEXT` ('promo'|'normal'), `mayar_license_code TEXT`, `mayar_product_id TEXT`, `mayar_customer_id TEXT`.
- Tabel `mayar_webhook_events (id, event_type, transaction_id UNIQUE, payload JSONB, processed_at, created_at)` untuk idempotensi (UNIQUE `transaction_id` → insert gagal saat duplikat).
- *Alternatif ditolak*: tabel `subscriptions` terpisah — lebih banyak join; user butuh ≤1 langganan aktif dan kolom di `users` cukup, konsisten dengan pola skema yang ada.

### D3. Webhook: endpoint publik yang verifikasi + idempoten
`app/api/payments/webhook/route.ts` (POST, tanpa auth user):
1. Baca body JSON; validasi `data.merchantId` sama dengan `MAYAR_MERCHANT_ID` (env) → selain itu 401.
2. Cek duplikat via `transactionId` di `mayar_webhook_events` (UNIQUE) → 200 tanpa proses ulang.
3. `payment.received` / `membership.newMemberRegistered` → cari user by `customerEmail` di `users`; set `is_premium=true`, `premium_tier` sesuai `amount`/`productId` yang cocok, `premium_until = now + 30 hari` (fallback bila license verify gagal), simpan `mayar_customer_id`/`product_id`; bila `licenseCode` tersedia di payload, simpan juga.
4. `membership.memberExpired` / `memberUnsubscribed` → `is_premium=false`.
5. Selalu balas 200 (kecuali 401 verifikasi) agar Mayar tidak retry tanpa perlu.
- *Alternatif*: verifikasi license Mayar di dalam webhook — tidak wajib; verifikasi berkala di D4 lebih baik karena license code sering tidak ada di payload webhook.

### D4. Verifikasi lisensi berkala saat status diminta
`lib/premium.ts` — helper `getPremiumStatus(userId)` / `assertPremium(userId)`:
- Baca `is_premium` + `premium_until` dari DB. Bila `premium_until` sudah lewat → non-premium.
- Bila `mayar_license_code` ada dan `premium_until` < 12 jam lagi → panggil `saas/v1/license/verify`; `isLicenseActive=false` → set non-premium; aktif → perbarui `premium_until` dari `licenseCode.expiredAt`.
- Cache hasil per-request (jangan panggil Mayar setiap request chat).

### D5. Gating fitur premium + kuota free
`lib/premium.ts` menyediakan `enforcePremium(userId, feature)` yang dipanggil di awal route AI (setelah auth):
- `assistant-chat`: free → 10 pesan/hari (dihitung dari `ai_chat_messages` hari ini); premium → tanpa batas. Bila `webSearch:true` → wajib premium.
- `note-generate`: free → 3 catatan/bulan (hitung `notes` created_at bulan ini); premium → tanpa batas.
- `assistant-image`: wajib premium.
- `assistant-quiz` / `assistant-flashcards`: free → 2/hari; premium → tanpa batas.
- `bab-regenerate` (enrichment bab): free → 3/bulan; premium → tanpa batas.
- Response saat ditolak: HTTP 402 dengan `{ error, upgradeUrl: "/pricing" }` — frontend menampilkan notifikasi + tombol ke `/pricing`.
- *Alternatif ditolak*: gating client-side — tidak aman; semua keputusan di server.

### D6. Checkout endpoint & UI
`app/api/payments/checkout/route.ts` (POST, auth user): validasi tier → `payment/create` ke Mayar dengan `name`/`email`/`amount`/`mobile`/`redirectUrl` (env `MAYAR_REDIRECT_URL`, default `/dashboard?upgrade=success`) → return `{ link }`.
Frontend: `app/pricing/page.tsx` & `components/KemerdekaanPopup.tsx` memanggil checkout lalu `window.location.href = link`; status premium diambil dari `GET /api/payments/status` (auth user → `{ isPremium, tier, premiumUntil }`) dan dipakai untuk badge di `Sidebar.tsx` + mengubah halaman pricing menjadi tampilan "aktif".

### D7. Env & konfigurasi
`.env.local` + produksi VPS: `MAYAR_API_KEY`, `MAYAR_MERCHANT_ID`, `MAYAR_PRODUCT_ID_PROMO`, `MAYAR_PRODUCT_ID_NORMAL`, `MAYAR_REDIRECT_URL`. Tidak ada dependency npm baru (pakai `fetch` + Supabase yang sudah ada). URL webhook produksi: `https://api.eureka-ai.web.id/api/payments/webhook` (didafatarkan via `POST /hl/v1/webhook/register` atau dashboard Mayar).

## Risks / Trade-offs

- **Webhook tidak punya signature kriptografis yang terdokumentasi** → mitigasi: validasi `merchantId` + cocokkan `amount` dengan tier yang tercatat + idempotensi `transactionId`; sandbox dulu di `api.mayar.io`.
- **License code sering tidak ada di payload webhook membership** → mitigasi: aktivasi berbasis email + `premium_until = now+30d`, verifikasi lisensi nyata dilakukan berkala (D4) bila code tersimpan; bila user pindah email, admin bisa perbaiki manual.
- **Email user di `users` bisa beda dengan email pembayaran Mayar** → mitigasi: log `mayar_webhook_events.payload` untuk audit; fallback cari user by email case-insensitive; catat di open questions apakah perlu "klaim langganan manual" via kode.
- **Penyalahgunaan kuota free (multi-akun)** → di luar scope; kuota per-user sudah cukup untuk MVP.
- **Harga promo Rp 5.000 dengan fee Mayar (Subscription 4% + channel fee)** → risiko margin tipis; dicatat sebagai pertimbangan bisnis (bisa dibebankan ke customer via setting Mayar), bukan keputusan teknis.
- **Kegagalan Mayar saat checkout** → 502 ke user + tombol coba lagi; tidak ada state parsial di DB kita.

## Migration Plan

1. Jalankan `supabase_patch_007_mayar_subscription.sql` di Supabase (prod + dev).
2. Tambah env `MAYAR_*` di `.env.local` (dev) dan VPS.
3. Deploy backend (git pull + pm2 restart eureka-api) → daftarkan URL webhook di dashboard Mayar (atau `webhook/register`).
4. Deploy frontend (Vercel auto).
5. Uji sandbox Mayar (`api.mayar.io`): checkout promo & normal, webhook `payment.received` → premium aktif, `memberExpired` → nonaktif.
6. Rollback: hapus mount route + kembalikan kolom (atau biarkan kolom tak terpakai); frontend lama aman karena endpoint baru hanya ditambah.

## Open Questions

- Format pasti payload webhook `membership.newMemberRegistered` (apakah memuat `licenseCode`?) — aman dijawab saat implementasi dengan data sandbox; desain sudah defensif terhadap dua kemungkinan.
- Apakah perlu alur "klaim langganan" manual bila email Mayar ≠ email akun? Dapat ditunda; log audit cukup untuk MVP.
- Kuota free (10 pesan/hari, 3 catatan/bulan, dst.) adalah usulan awal — angka bisa disesuaikan tanpa mengubah desain.
