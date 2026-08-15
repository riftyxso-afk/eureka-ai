## 1. Perbaiki JSON-LD landing (app/page.tsx)

- [x] 1.1 Hapus blok `potentialAction` (SearchAction) dari objek `WebSite` di `jsonLd` landing karena tidak ada halaman search di situs
- [x] 1.2 Hapus `sameAs: []` kosong dari objek `Organization`, pertahankan komentar TODO untuk link media sosial

## 2. Perluas robots.txt (app/robots.ts)

- [x] 2.1 Tambah user-agent bot AI generatif yang belum ada: `Applebot-Extended`, `Meta-ExternalAgent`, `Bytespider`, `Amazonbot` (masing-masing dengan `allow: "/"`)
- [x] 2.2 Tambah `disallow: ["/api/"]` ke aturan crawler (rule `*` dan rule bot eksplisit) agar crawl budget tidak terbuang ke endpoint API

## 3. Lengkapi llms.txt (AEO/GEO)

- [x] 3.1 Buat `public/llms-full.txt` berisi versi lengkap profil Eureka.AI (layanan, fitur per sumber materi, paket & harga, FAQ singkat) dengan fakta yang diverifikasi dari landing/pricing
- [x] 3.2 Tautkan `llms-full.txt` dari `public/llms.txt` (baris tautan ke versi lengkap) sesuai konvensi llmstxt.org

## 4. Verifikasi

- [x] 4.1 Jalankan typecheck/build (`npm run build`) dan pastikan sukses
- [x] 4.2 Cek SSR HTML landing masih memuat `<script type="application/ld+json">` tanpa `potentialAction` dan tanpa `sameAs` kosong
- [x] 4.3 Validasi output `/robots.txt` memblokir `/api/` dan mengizinkan halaman publik untuk semua bot yang didaftarkan (opsional: jalankan dev server dan cek responsnya)
- [x] 4.4 Pastikan `/llms.txt` dan `/llms-full.txt` tersaji (file ada di `public/` dan tidak bentrok dengan route lain)
