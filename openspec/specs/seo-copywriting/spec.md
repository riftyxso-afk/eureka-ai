## Purpose

Mengoptimalkan konten dan struktur teknis situs agar halaman publik Eureka.AI tampil baik di mesin pencari (Google) — copy yang lengkap, metadata per halaman, sitemap, robots, dan data terstruktur.

## Requirements

### Requirement: Copy lengkap & kaya kata kunci untuk halaman publik
Halaman landing dan pricing HARUS memuat copy lengkap dalam Bahasa Indonesia yang akurat terhadap fitur (AI tutor Socratic, catatan otomatis, kuis & kartu hafalan, kolaborasi, streak/XP, harga Free/Pro) dan memakai kata kunci relevan secara wajar tanpa menyesatkan.

#### Scenario: Landing memuat copy lengkap
- WHEN mesin pencari (atau pengguna) membaca halaman landing
- THEN halaman memuat deskripsi layanan, fitur, cara kerja, harga, dan CTA dengan kata kunci yang relevan

#### Scenario: Pricing memuat detail harga
- WHEN mesin pencari membaca halaman harga
- THEN halaman memuat detail paket Free dan Pro (Rp 0 / Rp 59.000), daftar fitur, dan CTA

### Requirement: Metadata unik per halaman publik
Setiap halaman publik (landing, pricing, halaman auth) HARUS memiliki `title` dan `description` unik yang relevan dengan isinya. Metadata default di layout menjadi fallback yang masuk akal.

#### Scenario: Tiap halaman punya title/description sendiri
- WHEN pengguna atau crawler membuka landing, pricing, atau halaman auth
- THEN masing-masing menampilkan title dan description yang unik dan relevan

### Requirement: Sitemap & robots untuk indexing
Situs HARUS menyediakan `sitemap.xml` yang memuat semua halaman publik dengan URL kanonik (`https://www.eureka-ai.web.id`), serta `robots.txt` yang mengizinkan crawler mengindeks halaman publik.

#### Scenario: Sitemap memuat halaman publik
- WHEN crawler meminta /sitemap.xml
- THEN sitemap memuat URL kanonik landing, pricing, dan halaman publik lain

#### Scenario: Robots mengizinkan indexing
- WHEN crawler meminta /robots.txt
- THEN robots mengizinkan akses ke sitemap dan mengindeks halaman publik

### Requirement: Data terstruktur JSON-LD
Halaman landing HARUS memuat data terstruktur JSON-LD untuk Organization/SoftwareApplication dan FAQ; halaman pricing HARUS memuat data terstruktur untuk Product/Offer dengan harga yang benar (Rp 0 dan Rp 59.000, mata uang IDR).

#### Scenario: Landing memuat JSON-LD
- WHEN crawler membaca halaman landing
- THEN tersedia JSON-LD Organization/SoftwareApplication dan FAQ yang valid

#### Scenario: Pricing memuat JSON-LD produk
- WHEN crawler membaca halaman pricing
- THEN tersedia JSON-LD Product/Offer dengan harga dan mata uang yang benar

### Requirement: Konsistensi Open Graph & Twitter
Open Graph dan Twitter Card yang sudah ada di layout HARUS tetap konsisten dengan title/description/copy terbaru dan memakai URL kanonik yang sama.

#### Scenario: OG/Twitter konsisten
- WHEN halaman publik dibagikan ke media sosial
- THEN pratinjau memakai title, description, dan gambar yang sesuai copy terbaru
