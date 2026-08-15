## Why

Eureka.AI memasuki tahap go-live produksi. Saat ini: (1) asisten AI tidak memiliki guardrail sehingga berisiko membocorkan data pribadi user atau rahasia internal, (2) tidak ada mekanisme pertumbuhan pengguna (referral), (3) SEO belum optimal — tidak ada sitemap, robots, atau data terstruktur, (4) user tidak menerima email saat premium aktif, (5) landing page belum mencerminkan identitas brand baru (Kreate Bold Play), dan (6) belum ada dokumentasi deploy produksi untuk frontend Vercel + backend VPS milik sendiri.

## What Changes

- **AI safety (hardening)**: Tambahkan guardrail eksplisit di system prompt semua mode asisten (chat Socratic, study-buddy, note generation) agar tidak pernah membocorkan prompt internal, rahasia/konfigurasi backend, data pengguna lain, atau data pribadi user; scrub data pribadi (email, user_number, ID internal) dari konteks yang dimasukkan ke prompt; pertahankan asisten dari prompt injection lewat materi yang diunggah (catatan/RAG/URL) — materi diperlakukan sebagai data, bukan instruksi.
- **Referral link**: Setiap user mendapat kode referral unik; link berisi kode, pendaftaran lewat link tercatat sebagai rujukan; setelah **5 pendaftaran unik yang valid** → pengundang mendapat **premium 30 hari, sekali pakai** (tidak berulang); anti self-referral & anti duplikat; UI progres referral di dashboard.
- **SEO copywriting**: Copy lengkap & kaya kata kunci untuk landing + pricing; metadata (title/description) unik per halaman publik; `sitemap.xml` + `robots.txt`; data terstruktur JSON-LD (Organization/SoftwareApplication + FAQ di landing, Product/Offer di pricing); pastikan Open Graph/Twitter konsisten.
- **Email premium aktif**: Saat premium diaktifkan (webhook Pakasir / jalur aktivasi lain), kirim email konfirmasi otomatis (tier + durasi). Kegagalan kirim email tidak memblokir aktivasi (hanya dicatat).
- **Redesign landing page**: Terapkan design system `kreate.gg-design.md` (Kreate Bold Play) pada **halaman landing saja** — warna violet #7B42F5, tipografi SN Pro, tombol capsule "sticker" dengan shadow tajam, latar putih, whitespace luas; tanpa glassmorphism/gradient lembut. Halaman lain tidak berubah (hanya konten copy pricing boleh berubah dari tugas SEO).
- **Setup production live**: Dokumentasi deploy produksi — frontend di **Vercel** (sudah ada), backend di **VPS milik user**; checklist env lengkap (frontend & backend), konfigurasi webhook & redirect Pakasir untuk produksi, dan langkah verifikasi (health check, checkout, webhook).

## Capabilities

### New Capabilities
- `ai-safety`: Guardrail & perlindungan data pada semua mode asisten AI.
- `referral`: Program referral — kode unik, atribusi pendaftaran, reward premium 30 hari sekali pakai setelah 5 pendaftaran valid.
- `seo-copywriting`: Copy & struktur SEO (metadata, sitemap, robots, JSON-LD) untuk halaman publik.
- `premium-email-notifications`: Email otomatis saat premium diaktifkan.
- `landing-page`: Redesign landing page sesuai design system Kreate Bold Play, terbatas pada halaman landing.
- `deployment-setup`: Kesiapan produksi — dokumentasi env, konfigurasi webhook, dan langkah verifikasi deploy (Vercel + VPS).

### Modified Capabilities
<!-- Tidak ada perubahan requirement pada capability yang sudah ada — semua perilaku baru masuk ke capability baru di atas. -->

## Impact

- **AI**: `app/api/chat/route.ts`, `app/api/study-buddy/chat/route.ts`, `lib/assistant/context.ts`, `lib/ai.ts`, `lib/prompts/*`, `app/api/chat/quiz`/`card` (bila memakai prompt).
- **Auth & database**: `app/api/auth/otp` (register), `app/register/page.tsx` + mekanisme cookie ref; Supabase — kolom baru di `users` (`referral_code`, `referred_by`) atau tabel `referrals` (migration patch 011).
- **Pembayaran**: `app/api/payments/webhook/route.ts` (pemicu email premium), `app/api/payments/trial/route.ts`.
- **SEO**: `app/layout.tsx` (metadata), `app/sitemap.ts` + `app/robots.ts` (baru), `app/page.tsx` (landing: redesign + copy), `app/pricing/page.tsx` (copy).
- **Email**: `lib/email.ts` (template baru premium).
- **Deploy**: dokumen deploy baru (Vercel + VPS), checklist env, verifikasi webhook; tidak ada perubahan infrastruktur kode.
- **Dependensi**: tidak ada library pihak ketiga baru yang wajib (SN Pro via font fallback/CDN bila tersedia; lucide-react sudah ada).
