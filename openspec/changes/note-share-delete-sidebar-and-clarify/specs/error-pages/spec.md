## Purpose

Menyediakan halaman error custom yang konsisten dengan branding clay Eureka, menggantikan halaman 404 bawaan Next.js agar pengguna yang salah mengetik URL mendapat pesan ramah dan jalan pulang yang jelas.

## ADDED Requirements

### Requirement: Halaman 404 custom bergaya Eureka

Sistem SHALL menampilkan halaman 404 custom di seluruh aplikasi saat pengguna mengunjungi URL yang tidak ada, dengan tampilan yang konsisten dengan branding clay Eureka (logo, warna, kartu) — bukan template bawaan framework.

#### Scenario: Mengunjungi URL yang tidak ada

- **WHEN** pengguna membuka URL yang tidak terdaftar (mis. `/apa-gitu`)
- **THEN** sistem menampilkan halaman 404 bergaya Eureka dengan pesan bahwa halaman tidak ditemukan

#### Scenario: Jalan pulang dari halaman 404

- **WHEN** pengguna melihat halaman 404
- **THEN** halaman menampilkan tombol/tautan kembali ke beranda atau dashboard yang berfungsi

#### Scenario: URL salah ketik di area login

- **WHEN** pengguna yang sudah login membuka URL yang tidak ada di dalam area dashboard
- **THEN** halaman 404 yang sama tetap tampil dengan tautan kembali ke dashboard
