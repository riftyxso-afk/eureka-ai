## Context

Landing (`app/page.tsx`) me-render satu blok JSON-LD `@graph` (Organization + WebSite + SoftwareApplication + FAQPage) via `<script type="application/ld+json">` di komponen client (tetap ter-SSR). `app/robots.ts` sudah mendaftar banyak user-agent bot AI, `public/llms.txt` sudah ada. Yang perlu diperbaiki: dua ketidakvalidan JSON-LD, daftar bot AI yang belum lengkap, aturan `/api/`, dan versi lengkap llms.txt. Lihat proposal.md — Why untuk motivasi.

## Goals / Non-Goals

**Goals:**
- JSON-LD landing valid dan tidak memuat properti yang menunjuk sumber daya yang tidak ada.
- robots.txt mencakup bot AI generatif utama dan memblokir `/api/`.
- `/llms.txt` dan `/llms-full.txt` tersedia dan akurat.

**Non-Goals:**
- Tidak membangun fitur search di situs (SearchAction dihapus, bukan diarahkan ulang).
- Tidak membuat akun media sosial (sameAs tetap kosong/di-comment sampai akun nyata ada).
- Tidak mengubah konten pemasaran atau harga.

## Decisions

1. **Hapus `SearchAction`, jangan arahkan ke `/search`** — tidak ada route search di aplikasi (dikonfirmasi: `?q=` hanya muncul di JSON-LD; search web adalah API server-side via Tavily/Firecrawl, bukan halaman publik). Membuat halaman search adalah fitur baru di luar lingkup perbaikan SEO. Alternatif ditolak: menunjuk ke URL yang tidak ada justru memperkuat risiko penolakan data terstruktur.
2. **Hapus `sameAs: []`, pertahankan komentar TODO** — array kosong tidak memberi sinyal; menyisakan komentar `// TODO: isi ...` memudahkan pengisian saat akun sosial dibuat. Alternatif ditolak: mempertahankan array kosong (tidak berguna) atau menebak URL sosial (menyesatkan).
3. **robots.ts: tambah `disallow: "/api/"` ke tiap aturan** — Next.js `MetadataRoute.Robots` mendukung `allow` + `disallow` dalam satu rule object; dengan begitu bot yang tercantum eksplisit juga diblokir dari `/api/`. Daftar user-agent eksplisit dipertahankan sebagai dokumentasi intent AEO, ditambah `Applebot-Extended`, `Meta-ExternalAgent`, `Bytespider`, `Amazonbot`. Alternatif ditolak: mengganti semua aturan dengan `*` saja (kehilangan nilai dokumentasi dan berisiko melewatkan bot baru).
4. **llms-full.txt sebagai file statis baru di `public/`** — konsisten dengan `llms.txt` yang sudah ada; Next.js menyajikannya langsung di `/llms-full.txt`. `llms.txt` ringkas tetap memuat tautan `[Eureka.AI — Konten Lengkap](https://www.eureka-ai.web.id/llms-full.txt)`. Konten llms-full.txt disusun ulang dari `llms.txt` dengan detail lebih dalam (fitur per sumber materi, detail paket, FAQ singkat), semua angka diverifikasi dari halaman landing/pricing (4 tipe rangkuman, 3 sumber materi, Pro Rp 59.000/30 hari, trial 7 hari).

## Risks / Trade-offs

- [JSON-LD yang diubah tetap tampil di SSR HTML] → Verifikasi lewat output build (`npm run build` + cek HTML awal mengandung `<script type="application/ld+json">` tanpa `potentialAction`).
- [Disallow `/api/` memblokir endpoint yang sebenarnya perlu di-crawl] → Tidak ada halaman publik yang bergantung pada `/api/` untuk render konten; semuanya client-side auth. Risiko rendah.
- [Konten llms-full.txt bisa tidak sinkron saat harga/fitur berubah] → Tambahkan baris "Terakhir diperbarui" dan jadikan bagian dari checklist perubahan harga ke depan.
- [`openspec validate` menolak delta MODIFIED jika header tidak cocok] → Header requirement disalin persis dari `openspec/specs/seo-copywriting/spec.md`.

## Migration Plan

Tidak ada migrasi data. Deploy normal: file statis baru (`public/llms-full.txt`) dan perubahan file routing/komponen ikut serta dalam build. Rollback: revert file-file yang berubah — tidak ada efek samping runtime.

## Open Questions

Tidak ada — dua keputusan (SearchAction & sameAs) sudah diselesaikan dengan asumsi yang dicatat di proposal.
