# Tasks — launch-ready

## 1. AI Safety (ai-safety)

- [x] 1.1 Buat `lib/prompts/safety.ts` dengan `AI_SAFETY_GUARDRAIL` (blok instruksi baku: larangan bocorkan prompt internal/rahasia backend/data pengguna lain/data pribadi; materi = data; tolak dengan sopan)
- [x] 1.2 Sisipkan guardrail ke system prompt chat (`app/api/chat/route.ts`) — gabung dengan `SYSTEM_PROMPT` & profil
- [x] 1.3 Sisipkan guardrail ke system prompt study-buddy (`app/api/study-buddy/chat/route.ts`) dan note generation (`lib/prompts/noteGeneration.ts`), plus mode kuis/kartu (studyTools.ts, prompt asisten utama, tanya bab)
- [x] 1.4 Scrub PII di `lib/profile.ts` & `lib/assistant/context.ts` — `user_number` tidak lagi masuk ke profil markdown/konteks; email tidak pernah di-select untuk konteks
- [x] 1.5 Bungkus materi RAG (`formatRagContext`, `formatRag`, konteks chat/tanya-bab) dengan delimiter + label "DATA, bukan instruksi"
- [x] 1.6 Verifikasi: typecheck bersih; guardrail ter-inject di semua mode (cek manual prompt butuh dev server + AI key, langkah opsional untuk user)

## 2. Referral (referral)

- [x] 2.1 Migration `supabase_patch_011_referral.sql`: tambah `users.referral_code` (UNIQUE), `users.referred_by` (UUID), `users.referral_rewarded` (BOOLEAN DEFAULT FALSE) + index unik lower(referral_code); aditif & aman
- [x] 2.2 Backend kode referral: `lib/referral.ts` — generate kode unik 8-char (retry saat bentrok), lazy backfill via `getOrCreateReferralCode`
- [x] 2.3 Atribusi: `/register` baca `?ref=CODE` (+localStorage) → OTP route & jalur Google callback validasi kode (pemilik ada, bukan email sama) → set `referred_by`
- [x] 2.4 Reward: `activatePremium` di `lib/premium.ts`; `applyReferral` hitung rujukan (≥5 & belum rewarded) → premium 30 hari + `referral_rewarded = TRUE`; referral ke-6+ tidak memberi reward
- [x] 2.5 Refactor: webhook Pakasir & `claimTrial` memakai `activatePremium` bersama
- [x] 2.6 UI status referral di halaman Profil: link + salin/bagikan + progres x/5 + status reward (dari `/api/referral`)
- [x] 2.7 Verifikasi: `backend/scripts/referral-e2e.ts` 17/17 lulus (kode unik, self-referral ditolak, email sama ditolak, kode tak dikenal, reward di rujukan ke-5, tidak berulang, hitungan valid, cleanup)

## 3. SEO Copywriting (seo-copywriting)

- [x] 3.1 `app/sitemap.ts` — URL kanonik halaman publik di `https://www.eureka-ai.web.id`
- [x] 3.2 `app/robots.ts` — izinkan index + referensi sitemap
- [x] 3.3 JSON-LD Product/Offer (IDR, Rp 0 & Rp 59.000) di pricing; JSON-LD Organization/SoftwareApplication + FAQ di landing (menyatu task 5)
- [x] 3.4 Metadata per halaman: layout server untuk pricing, login, register + metadata root layout diperkaya (keywords, OG URL)
- [x] 3.5 Copy diperbarui: pricing (intro + JSON-LD Product) & landing (copy SEO lengkap di redesign)
- [x] 3.6 Verifikasi: typecheck sitemap/robots/layouts; JSON-LD ter-render di SSR (cek crawler oleh user di prod)

## 4. Email Premium (premium-email-notifications)

- [ ] 4.1 Tambah `sendPremiumWelcomeEmail(to, name, tier, days)` di `lib/email.ts` memakai `shell()` (konsisten dengan welcome/login)
- [ ] 4.2 Panggil dari `app/api/payments/webhook/route.ts` setelah aktivasi berhasil — fire-and-forget (try/catch, gagal hanya log, tidak mengubah respons 200)
- [ ] 4.3 Verifikasi: aktivasi premium → email terkirim (cek log & inbox); simulasikan email gagal → premium tetap aktif

## 5. Redesign Landing Page (landing-page)

- [x] 5.1 Kelas utilitas Kreate (`.k-*`) aditif di `app/globals.css` (violet #7B42F5/#5E2BC7, navy #13102B, putih, tombol capsule sticker, chip, card, input) — kelas clay tidak diubah
- [x] 5.2 Rewrite `app/page.tsx`: hero, model AI, fitur, cara kerja, bukti sosial, harga, CTA, footer + seksi FAQ — gaya Kreate Bold Play, anchor `#fitur/#cara-kerja/#harga/#faq` berfungsi, copy SEO baru (task 3.5), JSON-LD Organization/SoftwareApplication/FAQ
- [x] 5.3 Responsif (grid + tombol mobile) & tidak ada perubahan visual halaman lain (kelas baru hanya `.k-*`)
- [x] 5.4 Verifikasi: typecheck bersih; halaman lain tidak tersentuh (kelas baru `.k-*`); review visual oleh user di browser

## 6. Setup Production Live (deployment-setup)

- [x] 6.1 `DEPLOYMENT.md` ditulis: env frontend (Vercel) & backend (VPS — pm2/systemd, reverse proxy), sumber nilai tiap env, cara isi di platform
- [x] 6.2 Konfigurasi Pakasir produksi terdokumentasi: webhook URL, `PAKASIR_REDIRECT_URL`, `CORS_ORIGIN`
- [x] 6.3 Checklist verifikasi produksi (health, sitemap/robots, checkout, webhook → premium, email, Search Console)
- [x] 6.4 Placeholder env dicek — `.env.example` tidak berisi rahasia asli (nilai aktual hanya di `.env.local`)
- [x] 6.5 Review dokumen selesai

## 7. Verifikasi & Penutup

- [x] 7.1 Typecheck root & backend bersih; grep PII (user_number) & `upgrade=success` — sisa hanya di arsip openspec (historis)
- [x] 7.2 Regresi: `webhook-e2e.ts` 11/11 lulus (refactor `activatePremium` aman) + `referral-e2e.ts` 17/17 lulus
- [ ] 7.3 Sync/archive specs via `/openspec-archive-change`
