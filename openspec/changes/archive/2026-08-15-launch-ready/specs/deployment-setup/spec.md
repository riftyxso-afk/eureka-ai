## Purpose

Menyiapkan kesiapan produksi Eureka.AI — dokumentasi dan konfigurasi deploy untuk frontend di Vercel dan backend di VPS milik pengguna, termasuk env, URL webhook, dan langkah verifikasi, sehingga go-live dapat dilakukan tanpa tebak-tebakan.

## ADDED Requirements

### Requirement: Dokumentasi env produksi lengkap
HARUS ada dokumen deploy yang memuat daftar LENGKAP variabel lingkungan untuk frontend (Vercel) dan backend (VPS) — termasuk yang wajib (Supabase, auth, AI keys, Pakasir, Resend, CORS) — beserta cara mengisinya di masing-masing platform. Semua contoh nilai di `.env.example` TIDAK BOLEH berisi rahasia asli.

#### Scenario: Dokumen deploy memuat semua env
- WHEN pengembang membuka dokumen deploy produksi
- THEN tersedia daftar lengkap env frontend & backend dengan penjelasan dari mana mendapatkannya

#### Scenario: Rahasia tidak bocor ke repo
- WHEN repo diperiksa
- THEN tidak ada rahasia asli (API key, token) yang ter-commit; `.env.example` hanya berisi placeholder

### Requirement: Konfigurasi webhook & redirect Pakasir produksi
Konfigurasi produksi HARUS mencakup URL webhook Pakasir (`https://<domain>/api/payments/webhook`) yang dapat diisi di dashboard Pakasir, `PAKASIR_REDIRECT_URL` menuju domain produksi, dan `CORS_ORIGIN` yang benar — dengan langkah dokumentasi cara mengaturnya.

#### Scenario: Webhook URL produksi terdokumentasi
- WHEN pengembang menyiapkan produksi
- THEN dokumen menjelaskan nilai webhook URL, redirect URL, dan CORS yang harus diisi

#### Scenario: Domain produksi konsisten
- WHEN aplikasi produksi berjalan
- THEN redirect checkout dan webhook memakai domain produksi (bukan localhost)

### Requirement: Langkah verifikasi produksi terdokumentasi
HARUS ada langkah verifikasi pasca-deploy yang terdokumentasi: health check backend, uji checkout (halaman bayar Pakasir terbuka), uji webhook (pembayaran sandbox → premium aktif), dan cek halaman publik (landing/pricing) dimuat normal.

#### Scenario: Checklist verifikasi tersedia
- WHEN pengembang selesai deploy
- THEN ada checklist langkah verifikasi yang dapat dijalankan (health, checkout, webhook, halaman publik)
