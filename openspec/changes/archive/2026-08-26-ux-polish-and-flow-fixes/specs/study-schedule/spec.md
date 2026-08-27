# study-schedule Delta

## Purpose

Manajemen jadwal belajar dengan pembedaan visual antar kegiatan melalui palet warna yang dapat dipilih pengguna saat menambah kegiatan.

## ADDED Requirements

### Requirement: Pilihan warna saat menambah kegiatan jadwal

Sistem SHALL menyediakan daftar pilihan warna saat pengguna menambahkan kegiatan jadwal, dan kegiatan yang disimpan SHALL tampil menggunakan warna yang dipilih pada kalender maupun daftar jadwal.

#### Scenario: Memilih warna dari daftar

- **WHEN** pengguna membuka form tambah kegiatan dan memilih salah satu warna dari daftar pilihan
- **THEN** kegiatan yang disimpan tampil dengan warna tersebut di tampilan jadwal

#### Scenario: Warna default tanpa pemilihan

- **WHEN** pengguna menyimpan kegiatan tanpa memilih warna
- **THEN** sistem menerapkan warna bawaan yang tetap terbedakan dari kegiatan lain secara acak/bergiliran, bukan satu warna seragam untuk semua kegiatan

### Requirement: Palet warna terbatas dan konsisten

Daftar warna yang ditawarkan SHALL berasal dari palet tetap aplikasi (bukan pemilih warna bebas), mencakup cukup pilihan agar kegiatan mata pelajaran yang berbeda dapat dibedakan, dan SHALL terbaca baik di mode terang maupun gelap.

#### Scenario: Jumlah pilihan memadai

- **WHEN** pengguna membuka daftar pilihan warna pada form tambah kegiatan
- **THEN** tersedia minimal 8 warna berbeda dari palet resmi aplikasi

#### Scenario: Warna terbaca di kedua mode tema

- **WHEN** kegiatan dengan warna tertentu dilihat pada mode terang lalu pada mode gelap
- **THEN** label/judul kegiatan pada blok berwarna tetap kontras dan terbaca di kedua mode
