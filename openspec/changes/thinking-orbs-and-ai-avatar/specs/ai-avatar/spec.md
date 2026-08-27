# ai-avatar Delta

## Purpose

Identitas visual asisten Eureka.AI di dalam percakapan: avatar blob lembut beranimasi (dua mata hidup) yang menggantikan logo statis di samping setiap bubble respons AI, lengkap dengan fallback aksesibilitas.

## ADDED Requirements

### Requirement: Avatar blob beranimasi di samping respons AI

Setiap bubble respons asisten di halaman chat SHALL menampilkan avatar blob beranimasi (bentuk bulat organik dengan dua mata yang bergerak halus) menggantikan logo statis; avatar TIDAK BOLEH mengubah lebar kolom chat maupun menyebabkan lonjakan layout.

#### Scenario: Respons AI muncul dengan avatar baru

- **WHEN** asisten mengirim sebuah respons di halaman chat
- **THEN** di samping bubble tampil avatar blob beranimasi berukuran sama dengan slot logo sebelumnya (±32px)

#### Scenario: Avatar tidak menggeser layout

- **WHEN** percakapan dimuat dengan banyak respons
- **THEN** tidak ada pergeseran layout (CLS) akibat pemuatan avatar

### Requirement: Animasi avatar menghormati reduced motion

Ketika `prefers-reduced-motion` aktif, animasi mata avatar SHALL dibekukan menjadi pose statis yang tetap menampilkan karakter blob utuh.

#### Scenario: Reduced motion aktif

- **WHEN** pengguna memiliki preferensi reduced motion lalu membuka percakapan
- **THEN** avatar tampil statis (mata pada posisi netral) tanpa error maupun animasi berjalan

### Requirement: Gaya animasi terisolasi

Definisi animasi avatar SHALL terisolasi (kelas/keyframes bernama khusus) sehingga tidak memengaruhi elemen lain dan aman dirender berulang dalam satu halaman.

#### Scenario: Banyak respons dalam satu layar

- **WHEN** percakapan memuat lebih dari satu respons asisten sekaligus
- **THEN** semua avatar beranimasi konsisten dan tidak ada gaya yang bocor ke komponen lain
