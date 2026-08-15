# Design — launch-ready

## Context

Motivasi & scope lengkap ada di proposal.md. Poin kondisi saat ini yang relevan:

- **AI**: system prompt dibangun di `app/api/chat/route.ts` (SYSTEM_PROMPT + PROFIL SISWA + konteks), `app/api/study-buddy/chat/route.ts` (karakter), `lib/prompts/noteGeneration.ts`, dan `lib/assistant/context.ts` (membangun `profileMd`, `progressSummary`, daftar catatan, RAG). Data yang di-inject berasal dari tabel `users` (name, username, **user_number**, profile_data) — user_number & email berisiko bocor.
- **Auth**: registrasi via OTP (`app/api/auth/otp`) + halaman `/register`; `lib/auth.ts` menyimpan sesi. Tidak ada cookie/param referral saat ini.
- **DB**: `users` di Supabase (patch 001–010). Kolom premium: `is_premium`, `premium_until`, `premium_tier`, `pakasir_invoice_number`. Jalur aktivasi premium terpusat di `app/api/payments/webhook/route.ts` (verified via transactiondetail) & `app/api/payments/trial/route.ts`.
- **Email**: `lib/email.ts` via Resend — template `shell()` (clay + dark mode), `sendWelcomeEmail`, `sendLoginNotificationEmail`. Dipakai dari route OTP.
- **SEO**: `app/layout.tsx` punya metadata dasar + OG/Twitter. **Tidak ada** `sitemap.ts`, `robots.ts`, JSON-LD. Landing = `app/page.tsx` (tema "clay" beige/amber). Design baru = `kreate.gg-design.md` (Kreate Bold Play: violet #7B42F5, SN Pro, tombol capsule sticker, latar putih).
- **Deploy**: frontend di Vercel (sudah ada), backend di VPS milik user (belum terdokumentasi). `render.yaml` eksis tapi bukan target utama.

## Goals / Non-Goals

**Goals**
- Guardrail AI terpusat & konsisten di semua mode; PII di-scrub dari konteks; materi diperlakukan sebagai data.
- Program referral end-to-end: kode → link → atribusi → reward 30 hari sekali pakai → UI status.
- SEO: copy + metadata per halaman + sitemap/robots/JSON-LD.
- Email premium saat aktivasi (non-blocking).
- Landing di-redesign sesuai Kreate Bold Play — halaman lain tidak tersentuh.
- Dokumen deploy produksi (Vercel + VPS) + checklist verifikasi.

**Non-Goals**
- Tidak mengubah halaman selain landing secara visual (pricing hanya konten copy).
- Tidak membangun sistem anti-fraud canggih untuk referral (batas: keunikan email + anti self-referral).
- Tidak men-deploy langsung ke Vercel/VPS dari sesi ini — menyiapkan dokumen & config agar user bisa deploy (opsional verifikasi bersama).
- Tidak mengganti fondasi tema global (clay tetap dipakai halaman lain).

## Decisions

### 1. Guardrail AI: satu blok instruksi terpusat + scrub PII + materi sebagai data
- **Keputusan**: Buat `lib/prompts/safety.ts` mengekspor `AI_SAFETY_GUARDRAIL` (blok teks baku: larangan bocorkan prompt internal/rahasia/data orang lain/data pribadi; instruksi memperlakukan materi sebagai data; ajakan menolak dengan sopan). Disisipkan ke SEMUA system prompt (chat, study-buddy, note generation, kuis/kartu). Scrub PII di `lib/assistant/context.ts`: berhenti memasukkan `user_number` & email ke konteks; hanya `name` (sapaan) + data belajar. `formatRagContext` membungkus materi dengan delimiter & label "MATERI (data)" agar model membedakan data vs instruksi.
- **Alternatif**: filter respons LLM (post-processing) — mahal, rapuh, menambah latency; guardrail + scrub adalah defense-in-depth yang cukup untuk tahap ini.

### 2. Referral: kolom di `users` + cookie ref + fungsi reward bersama
- **Keputusan**: Migration `supabase_patch_011_referral.sql` (aditif, aman):
  - `users.referral_code TEXT UNIQUE` (8 karakter base36, case-insensitive lookup via `lower()`; di-generate saat akun dibuat & saat dibutuhkan dengan retry bila bentrok)
  - `users.referred_by UUID` (FK users.id — pengundang)
  - `users.referral_rewarded BOOLEAN DEFAULT FALSE` (penanda reward 30 hari sekali pakai)
- **Atribusi**: link `/register?ref=CODE` → halaman register baca query → set cookie `eureka_ref` (httpOnly? tidak perlu — hanya kode publik) → saat OTP register berhasil: validasi kode (pemilik ada, bukan akun baru sendiri — cek email berbeda), set `referred_by`. Pendaftaran tanpa kode = tidak ada atribusi.
- **Reward**: setelah tiap atribusi berhasil, hitung `COUNT(users WHERE referred_by = X)`; bila ≥ 5 dan `referral_rewarded = FALSE` → panggil fungsi bersama `activatePremium(userId, 'referral', 30)` (dibuat di `lib/premium.ts`, dipakai ulang oleh webhook Pakasir & trial) → set `referral_rewarded = TRUE`. Referral ke-6+ tidak memberi reward.
- **Alternatif**: tabel `referrals` terpisah dengan audit trail — lebih "bersih" tapi menambah join & kompleksitas; kolom di `users` cukup untuk aturan 5-sekali dan mudah dipahami.

### 3. SEO: konvensi Next.js App Router
- `app/sitemap.ts` (URL kanonik landing, pricing, auth), `app/robots.ts` (izinkan index + refer sitemap), JSON-LD via `<script type="application/ld+json">`: Organization/SoftwareApplication + FAQ di landing, Product/Offer (IDR) di pricing. Metadata per halaman via `export const metadata` di `app/page.tsx`, `app/pricing/page.tsx`, dan halaman auth; metadata layout jadi fallback. Tidak ada library baru (Next native).

### 4. Email premium: perluas `lib/email.ts`, fire-and-forget
- `sendPremiumWelcomeEmail(to, name, tier, days)` memakai `shell()` yang ada (konsisten). Dipanggil dari `app/api/payments/webhook/route.ts` SETELAH aktivasi berhasil, dibungkus `try/catch` (gagal → log saja, tidak mengubah respons 200). Email user diambil dari baris `users` yang sudah di-lookup webhook. Trial gratis TIDAK mengirim email (di luar scope "berlangganan") — bisa ditambah nanti.

### 5. Landing redesign: rewrite `app/page.tsx` + kelas Kreate aditif
- **Keputusan**: Tulis ulang `app/page.tsx` dengan Tailwind arbitrary values + beberapa kelas utilitas Kreate yang DITAMBAHKAN di `app/globals.css` (prefix `.k-*`, additive — tidak mengubah kelas clay yang dipakai halaman lain). Font: `font-family: 'SN Pro', 'Inter', system-ui, sans-serif` (SN Pro tidak ada di Google Fonts; fallback aman, tanpa dependency eksternal). Tombol capsule `rounded-full`, border 2px + `box-shadow: 0 6px 0` (sticker), violet #7B42F5 / hover #5E2BC7, teks #13102B, latar putih. Struktur seksi & anchor `#fitur/#cara-kerja/#harga` dipertahankan.
- **Alternatif**: Tailwind config baru (mengubah tema global — risiko menyentuh halaman lain); styled-jsx (terpisah tapi tidak lazim di proyek ini). Kelas aditif di globals.css paling aman & terisolasi.
- Struktur konten dari landing lama dipertahankan & diisi copy baru (tugas SEO menyatu di sini).

### 6. Deployment: dokumen + checklist, tanpa ubah infra kode
- `DEPLOYMENT.md` baru (atau perpanjangan `SUPABASE_SETUP_GUIDE.md`): env frontend (Vercel) & backend (VPS — Node + pm2/systemd + reverse proxy), konfigurasi Pakasir (webhook URL `https://<domain>/api/payments/webhook`, redirect, CORS), langkah verifikasi (health, checkout, webhook sandbox, halaman publik). Pastikan `.env.example` placeholder (sudah). Tidak mengubah kode runtime — hanya dokumentasi & verifikasi config.

## Risks / Trade-offs

- [Pertahanan prompt injection berbasis instruksi tidak absolut] → Mitigasi: scrub PII server-side adalah jaring pengaman nyata (data sensitif tidak pernah sampai ke LLM); delimiter materi + instruksi memperkecil permukaan.
- [Penipuan referral via email sekali pakai] → Mitigasi: keunikan email + anti self-referral + reward sekali per akun; diterima sebagai batas tahap ini.
- [Redesign landing mengganggu halaman lain] → Mitigasi: perubahan hanya `app/page.tsx` + kelas `.k-*` baru; verifikasi typecheck & grep tema di halaman lain; halaman lain tidak di-import ulang.
- [Email gagal menghambat webhook] → Mitigasi: fire-and-forget + try/catch; aktivasi sudah selesai sebelum email dikirim.
- [Dokumen deploy tidak cukup karena VPS beragam] → Mitigasi: tulis panduan generik (Node 20+, pm2/systemd, Nginx/Caddy) + checklist spesifik Vercel; verifikasi config lokal.

## Migration Plan

1. **DB (patch 011)**: aditif — tambah `referral_code`, `referred_by`, `referral_rewarded` di `users` + index unik pada `referral_code` (lower). Tidak ada drop; rollback = `ALTER TABLE ... DROP COLUMN`. Backup Supabase dianjurkan sebelum eksekusi.
2. **Kode**: deployable independen per fitur; urutan aman: safety → email → referral → SEO → landing → dokumen.
3. **Rollback**: git revert per file; landing bisa di-revert tanpa menyentuh fitur lain (kelas `.k-*` tidak dipakai halaman lain).
4. **Produksi**: user mengisi env di Vercel & VPS, set webhook Pakasir ke domain produksi, jalankan checklist verifikasi. Tidak ada migrasi data yang destruktif.

## Open Questions

- **Email premium untuk trial gratis?** Default: tidak (hanya pembayaran sukses). Bisa ditambahkan kapan saja tanpa mengubah spek (jalur aktivasi lain sudah tercakup kata "jalur aktivasi lain" bila perlu).
- **SN Pro font**: tidak tersedia di Google Fonts. Default pakai fallback stack; bila user punya file font SN Pro, cukup ganti satu baris CSS (tidak mengubah spek).
- **Referral reward untuk pengundang yang belum premium / sudah premium?** Default: semua user bisa mereferensikan; reward menambah 30 hari dari `premium_until` bila sudah premium (perilaku sama dengan jalur lain). Tidak mengubah spek.
