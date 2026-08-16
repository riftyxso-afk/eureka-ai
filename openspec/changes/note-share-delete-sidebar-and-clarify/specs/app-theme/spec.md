## ADDED Requirements

### Requirement: Halaman pengaturan konsisten tema clay

Halaman `/dashboard/pengaturan` SHALL ditampilkan dengan gaya visual yang konsisten dengan tema clay Eureka (kartu, warna, kontrol, tipografi) dan SHALL tetap terbaca di mode terang maupun gelap — menggantikan gaya generik (gray/dark) yang ada.

#### Scenario: Halaman pengaturan bergaya clay

- **WHEN** pengguna membuka halaman pengaturan
- **THEN** halaman menampilkan kartu, warna, dan kontrol yang konsisten dengan tema clay area login

#### Scenario: Terbaca di mode gelap

- **WHEN** pengguna membuka halaman pengaturan dengan mode gelap aktif
- **THEN** seluruh konten dan kontrol tetap kontras dan terbaca, tanpa elemen yang menyatu dengan latar

#### Scenario: Fungsi pengaturan tetap utuh

- **WHEN** pengguna menggunakan halaman pengaturan setelah redesign
- **THEN** semua kontrol yang ada sebelumnya tetap berfungsi dengan cara yang sama
