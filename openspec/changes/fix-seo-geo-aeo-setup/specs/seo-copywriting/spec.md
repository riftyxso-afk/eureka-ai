## MODIFIED Requirements

### Requirement: Data terstruktur JSON-LD
Halaman landing HARUS memuat data terstruktur JSON-LD untuk Organization/SoftwareApplication dan FAQ; halaman pricing HARUS memuat data terstruktur untuk Product/Offer dengan harga yang benar (Rp 0 dan Rp 59.000, mata uang IDR). JSON-LD `WebSite` TIDAK BOLEH memuat `SearchAction` yang menunjuk halaman yang tidak ada di situs, dan `Organization` TIDAK BOLEH memuat array `sameAs` kosong.

#### Scenario: Landing memuat JSON-LD
- WHEN crawler membaca halaman landing
- THEN tersedia JSON-LD Organization/SoftwareApplication dan FAQ yang valid

#### Scenario: Pricing memuat JSON-LD produk
- WHEN crawler membaca halaman pricing
- THEN tersedia JSON-LD Product/Offer dengan harga dan mata uang yang benar

#### Scenario: JSON-LD tanpa SearchAction menyesatkan
- WHEN JSON-LD landing memuat tipe WebSite
- THEN tidak ada `SearchAction` yang menunjuk URL search yang tidak ada di situs (mis. `/?q=`)

#### Scenario: Organization tanpa sameAs kosong
- WHEN JSON-LD landing memuat tipe Organization
- THEN properti `sameAs` TIDAK ada atau berisi setidaknya satu URL sosial yang valid

### Requirement: Sitemap & robots untuk indexing
Situs HARUS menyediakan `sitemap.xml` yang memuat semua halaman publik dengan URL kanonik (`https://www.eureka-ai.web.id`), serta `robots.txt` yang mengizinkan crawler mengindeks halaman publik — termasuk bot AI generatif/answer-engine (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, dan sejenisnya) — dan memblokir akses ke `/api/`.

#### Scenario: Sitemap memuat halaman publik
- WHEN crawler meminta /sitemap.xml
- THEN sitemap memuat URL kanonik landing, pricing, dan halaman publik lain

#### Scenario: Robots mengizinkan indexing
- WHEN crawler mesin pencari atau bot AI generatif meminta /robots.txt
- THEN robots mengizinkan akses ke halaman publik dan sitemap

#### Scenario: Robots memblokir API
- WHEN crawler meminta URL di bawah /api/
- THEN robots.txt melarang akses (disallow) untuk crawler

## ADDED Requirements

### Requirement: llms.txt & llms-full.txt
Situs HARUS menyajikan `/llms.txt` (ringkasan singkat sesuai format llmstxt.org) dan `/llms-full.txt` (versi lengkap), dengan `llms.txt` memuat tautan ke `llms-full.txt`. Keduanya HARUS memuat fakta yang akurat tentang Eureka.AI: layanan (AI Tutor Socratic), fitur (catatan otomatis, kuis, kartu hafalan, kolaborasi), sumber materi (YouTube, artikel, PDF/DOCX/PPTX), dan harga (Gratis selamanya / Pro Rp 59.000).

#### Scenario: Bot AI membaca llms.txt
- WHEN bot AI generatif meminta /llms.txt
- THEN bot menerima ringkasan Eureka.AI dengan tautan halaman penting dan referensi ke llms-full.txt

#### Scenario: Bot AI membaca llms-full.txt
- WHEN bot AI generatif meminta /llms-full.txt
- THEN bot menerima konten lengkap yang akurat terhadap fitur dan harga Eureka.AI
