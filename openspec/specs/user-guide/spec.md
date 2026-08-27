# user-guide Specification

## Purpose

Buku panduan pengguna di dalam aplikasi: halaman bantuan berbahasa Indonesia yang menjelaskan cara memakai fitur-fitur inti Eureka.AI sehingga pengguna baru tidak perlu menebak-nebak.

## Requirements

### Requirement: Halaman buku panduan dalam aplikasi

Sistem SHALL menyediakan halaman buku panduan di dalam aplikasi area login yang menjelaskan cara menggunakan fitur-fitur inti (membuat catatan, uji pemahaman, flashcards, jadwal, misi, streaks, referral), dan halaman ini SHALL dapat dijangkau dari navigasi aplikasi tanpa keluar dari aplikasi.

#### Scenario: Membuka buku panduan dari aplikasi

- **WHEN** pengguna membuka kontrol "Panduan" dari navigasi/pengaturan aplikasi
- **THEN** halaman buku panduan terbuka memuat daftar isi fitur-fitur inti beserta cara pakainya

#### Scenario: Konten panduan berbahasa pengguna

- **WHEN** pengguna membaca buku panduan
- **THEN** seluruh konten tertulis dalam Bahasa Indonesia yang ramah pelajar, bukan dokumentasi teknis

### Requirement: Panduan dapat dicari dan dilompati

Buku panduan SHALL menyediakan daftar isi yang bisa diklik untuk melompat ke bagian fitur tertentu, dan setiap bagian SHALL berdiri sendiri (tidak wajib dibaca berurutan dari awal).

#### Scenario: Melompat ke bagian tertentu

- **WHEN** pengguna menekan item "Uji Pemahaman" pada daftar isi panduan
- **THEN** halaman menggulir/membuka langsung ke bagian penjelasan uji pemahaman

### Requirement: Panduan tersedia untuk pengguna yang melewati onboarding

Pengguna yang melewati onboarding SHALL diarahkan secara lembut (tanpa memaksa) ke buku panduan atau ditawari pintasan panduan, sehingga tetap punya jalur belajar mandiri tentang aplikasi.

#### Scenario: Pengguna skip onboarding diperlihatkan pintasan panduan

- **WHEN** pengguna yang melewati onboarding masuk pertama kali ke dashboard
- **THEN** aplikasi menampilkan pintasan sekali-saja menuju buku panduan yang dapat ditutup tanpa dipaksa membaca
