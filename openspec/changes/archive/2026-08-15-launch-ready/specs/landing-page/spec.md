## Purpose

Menerapkan design system Kreate Bold Play (dari `kreate.gg-design.md`) pada halaman landing Eureka.AI — identitas visual baru dengan violet, tipografi tebal, dan tombol capsule "sticker" — tanpa mengubah halaman lain.

## ADDED Requirements

### Requirement: Desain mengikuti Kreate Bold Play
Halaman landing HARUS mengikuti design system di `kreate.gg-design.md`: warna primary violet `#7B42F5` (hover `#5E2BC7`), teks navy gelap `#13102B`, latar putih dominan, tipografi SN Pro dengan headline sangat tebal (letter-spacing negatif), tombol capsule (`rounded-full`) dengan padding 18px 28px, tinggi 52px, border tegas dan shadow tajam ke bawah ("sticker"), kartu dengan border solid, input dengan border halus, chip violet.

#### Scenario: Landing memakai palet Kreate
- WHEN halaman landing dirender
- THEN palet warna utama mengikuti Kreate Bold Play (violet primary, navy teks, putih latar)

#### Scenario: Tombol bergaya sticker
- WHEN pengguna melihat tombol CTA utama di landing
- THEN tombol berbentuk capsule, berisi teks tebal, dengan border/edge dan shadow tajam ke bawah

#### Scenario: Tipografi tebal
- WHEN pengguna melihat headline hero dan section
- THEN tipografi SN Pro tebal dengan ukuran besar dan letter-spacing negatif sesuai skala design

### Requirement: Tanpa glassmorphism/gradient lembut
Halaman landing TIDAK BOLEH memakai soft gradients, glassmorphism, atau bayangan blur berat — depth dicapai lewat outline, kontras, dan shadow directional yang tajam.

#### Scenario: Tidak ada efek lembut
- WHEN halaman landing dirender
- THEN tidak ada gradient lembut, glassmorphism, atau shadow blur berat di komponen mana pun

### Requirement: Struktur fungsional landing tetap
Halaman landing HARUS tetap menyajikan struktur yang ada: navbar, hero, dukungan model AI, fitur, cara kerja, bukti sosial, harga, CTA akhir, dan footer — dengan gaya baru, termasuk tautan seksi (`#fitur`, `#cara-kerja`, `#harga`) yang tetap berfungsi.

#### Scenario: Navigasi seksi berfungsi
- WHEN pengguna mengklik tautan Fitur/Cara Kerja/Harga di navbar landing
- THEN halaman menggulir ke seksi yang benar

#### Scenario: Semua seksi tetap ada
- WHEN pengguna menggulir halaman landing
- THEN seksi hero, fitur, cara kerja, bukti sosial, harga, CTA, dan footer tetap tersedia

### Requirement: Terbatas pada halaman landing
Perubahan visual dari redesign ini TIDAK BOLEH memengaruhi halaman lain (dashboard, chat, profil, pricing styling, dll). Halaman lain tetap memakai tema lama; hanya konten copy pricing yang boleh berubah dari tugas SEO.

#### Scenario: Halaman lain tidak berubah
- WHEN pengguna membuka halaman dashboard, chat, atau halaman non-landing lain
- THEN tampilan halaman tersebut tetap seperti sebelumnya (tidak memakai tema Kreate)

### Requirement: Responsif
Halaman landing HARUS tampil baik di mobile dan desktop: navigasi dapat digunakan di layar kecil, grid menyesuaikan, dan whitespace proporsional di semua ukuran layar.

#### Scenario: Landing di mobile
- WHEN halaman landing dibuka di layar ponsel
- THEN konten tetap terbaca rapi dan CTA mudah diketuk

#### Scenario: Landing di desktop
- WHEN halaman landing dibuka di layar desktop
- THEN layout terpusat, simetris, dengan whitespace luas sesuai skala spacing Kreate (8/16/28/56/80)
