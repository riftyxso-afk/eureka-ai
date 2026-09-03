## Purpose

Menyediakan panel chat Eureka yang menempel di sisi browser dan mempertahankan sesi belajar saat siswa berpindah tab dalam window yang sama.

## ADDED Requirements

### Requirement: Side panel persisten antar tab

Sistem SHALL menampilkan chat Eureka dalam Chrome Side Panel yang tetap terbuka dan mempertahankan sesi aktif ketika pengguna berpindah tab dalam window yang sama.

#### Scenario: Pindah tab sesi terjaga

- **WHEN** sesi Socratic sedang berjalan lalu pengguna berpindah ke tab lain dalam window yang sama
- **THEN** side panel tetap terbuka dan isi percakapan sesi tersebut tidak hilang dan dapat dilanjutkan

### Requirement: Sinkron sesi dengan akun web app

Sistem SHALL menautkan sesi side panel ke akun Eureka.AI pengguna (login sekali, sesi persisten), sehingga riwayat dan progres sesi tersedia juga di web app.

#### Scenario: Login sekali

- **WHEN** pengguna yang sudah login di web app membuka ekstensi
- **THEN** ekstensi mengenali akun tersebut tanpa meminta login ulang selama sesi token masih berlaku

#### Scenario: Sesi kedaluwarsa

- **WHEN** sesi token akun sudah kedaluwarsa saat ekstensi dibuka
- **THEN** ekstensi meminta login ulang dengan jelas alih-alih gagal diam-diam

### Requirement: Ekstraksi hanya atas aksi eksplisit

Sistem SHALL hanya membaca konten halaman pada tab aktif ketika pengguna melakukan aksi eksplisit (memilih menu, menekan tombol ekstensi), dan SHALL TIDAK melakukan tracking atau ekstraksi pasif di latar belakang.

#### Scenario: Tanpa aksi tidak ada akses konten

- **WHEN** pengguna hanya menjelajah halaman tanpa memakai fitur ekstensi
- **THEN** ekstensi tidak membaca atau menyimpan konten halaman tersebut
