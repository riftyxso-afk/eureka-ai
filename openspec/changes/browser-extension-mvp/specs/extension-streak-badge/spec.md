## Purpose

Menampilkan penghitung streak belajar harian pada icon toolbar ekstensi agar kebiasaan belajar siswa terbentuk dan terlihat sekilas.

## ADDED Requirements

### Requirement: Badge streak pada icon toolbar

Sistem SHALL menampilkan angka streak harian pengguna sebagai badge pada icon toolbar ekstensi, yang diperbarui setiap ada aktivitas belajar tercatat.

#### Scenario: Streak bertambah

- **WHEN** aktivitas belajar tercatat pada hari baru yang berurutan
- **THEN** angka pada badge bertambah satu dan badge melakukan animasi "pop" sekali

#### Scenario: Streak terputus

- **WHEN** sehari terlewati tanpa aktivitas belajar tercatat
- **THEN** badge kembali menampilkan angka mulai yang benar tanpa animasi berulang

### Requirement: Badge mengikuti akun yang login

Angka badge SHALL mencerminkan streak milik akun yang sedang login di ekstensi, dan SHALL disembunyikan atau dinetralkan saat tidak ada pengguna yang login.

#### Scenario: Belum login

- **WHEN** ekstensi dibuka tanpa sesi akun yang valid
- **THEN** badge streak tidak menampilkan angka milik akun lain
