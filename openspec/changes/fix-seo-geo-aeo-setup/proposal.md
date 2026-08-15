## Why

Setup SEO/GEO/AEO yang dikerjakan di sesi sebelumnya belum tuntas dan menyisakan beberapa hal yang bisa merusak kredibilitas di Google maupun bot AI generatif: JSON-LD `WebSite` memuat `SearchAction` yang menunjuk halaman search yang tidak ada, `Organization` memuat `sameAs: []` kosong, `robots.txt` belum mencakup semua bot answer-engine, dan `llms.txt` belum punya versi lengkap (`llms-full.txt`). Ini berisiko membuat data terstruktur ditolak/diabaikan Google dan mengurangi peluang dikutip ChatGPT/Perplexity/Claude.

## What Changes

- **Hapus `SearchAction` palsu** dari JSON-LD `WebSite` di landing (`app/page.tsx`) — tidak ada halaman search di situs, jadi properti itu menyesatkan crawler. (Keputusan: dihapus, bukan dibuatkan halaman search — membangun fitur search di luar lingkup perbaikan SEO.)
- **Hapus `sameAs: []` kosong** dari JSON-LD `Organization` — array kosong tidak memberi sinyal apa pun; komentar TODO untuk link sosial nyata dipertahankan.
- **Perluas `robots.ts`**: tambah user-agent bot AI yang belum ada (`Applebot-Extended`, `Meta-ExternalAgent`, `Bytespider`, `Amazonbot`) dan tambah `Disallow: /api/` agar crawler tidak membuang crawl budget ke endpoint API.
- **Tambahkan `public/llms-full.txt`** (versi lengkap sesuai konvensi llmstxt.org) dan tautkan dari `public/llms.txt`.
- **Verifikasi**: build sukses dan JSON-LD tetap tampil di SSR HTML.

## Capabilities

### New Capabilities
- Tidak ada — semua perilaku baru masuk ke capability yang sudah ada.

### Modified Capabilities
- `seo-copywriting`: requirement berubah —
  1. "Data terstruktur JSON-LD": JSON-LD `WebSite` TIDAK BOLEH memuat `SearchAction` yang menunjuk halaman yang tidak ada; `Organization` TIDAK BOLEH memuat array `sameAs` kosong.
  2. "Sitemap & robots untuk indexing": `robots.txt` harus mengizinkan bot AI generatif/answer-engine dan memblokir `/api/`.
  3. (ADDED) "llms.txt & llms-full.txt": situs menyajikan `/llms.txt` ringkas + `/llms-full.txt` lengkap yang akurat terhadap fitur & harga.

## Impact

- `app/page.tsx` — objek `jsonLd` di landing (hapus `potentialAction` dan `sameAs`).
- `app/robots.ts` — daftar user-agent + aturan `disallow` untuk `/api/`.
- `public/llms.txt` — tautan ke versi lengkap.
- `public/llms-full.txt` — file baru.
- Tidak ada perubahan API, database, atau dependency. Tanpa risiko breaking bagi pengguna.
