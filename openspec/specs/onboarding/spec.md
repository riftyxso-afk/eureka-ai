# onboarding Specification

## Purpose

Mengatur alur orientasi pengguna baru: mengumpulkan nama, username, jenjang pendidikan, kelas, dan preferensi belajar, lalu menghasilkan rekomendasi awal — dengan opsi melewati alur tanpa memblokir akses aplikasi.

## Requirements

### Requirement: Pengguna dapat melewati onboarding

Alur onboarding SHALL menyediakan cara eksplisit untuk melewati (skip) seluruh langkah pengumpulan data dan analisis, dan pengguna yang skip SHALL tetap masuk ke aplikasi dengan status onboarding belum selesai — tidak ada langkah yang mengunci akses.

#### Scenario: Menekan lewati di tengah alur

- **WHEN** pengguna menekan kontrol "Lewati" pada langkah mana pun dalam onboarding
- **THEN** sistem mengonfirmasi singkat, menandai onboarding sebagai dilewati, dan membawa pengguna ke aplikasi tanpa menyimpan data langkah yang belum selesai

#### Scenario: Pengguna skip tetap bisa memakai aplikasi

- **WHEN** pengguna yang melewati onboarding membuka halaman area login apa pun
- **THEN** tidak ada redirect paksa kembali ke onboarding dan semua fitur gratis tetap dapat dipakai

### Requirement: Onboarding yang dilewati dapat dilengkapi dari profil

Pengguna yang melewati onboarding SHALL dapat melengkapinya kemudian dari halaman profil atau pintasan yang tersedia di aplikasi, dan setelah melengkapi, hasil analisisnya tersimpan sama seperti pengguna yang mengisi sejak awal.

#### Scenario: Melengkapi onboarding dari profil

- **WHEN** pengguna yang pernah skip membuka profil dan memilih untuk melengkapi data onboarding
- **THEN** sistem membuka alur onboarding mulai dari langkah pertama dan menyimpan hasilnya setelah selesai

#### Scenario: Status berubah setelah melengkapi

- **WHEN** pengguna menyelesaikan onboarding setelah sebelumnya skip
- **THEN** status onboarding pengguna menjadi selesai dan alur tidak lagi ditawarkan

### Requirement: Penyimpanan hasil onboarding konsisten

Sistem SHALL menyimpan hasil onboarding (nama, username, jenjang, kelas, jawaban psikologi, preferensi belajar, dan hasil analisis) pada satu sumber kebenaran di database, dan penyimpanan ini SHALL menjadi satu-satunya sumber yang dibaca oleh halaman profil dan fitur personalisasi lainnya.

#### Scenario: Hasil analisis tersimpan dan terbaca ulang

- **WHEN** pengguna menyelesaikan onboarding lalu membuka aplikasi dari perangkat lain
- **THEN** hasil onboarding (termasuk jenis kepribadian dan rekomendasi) tersedia dari database, bukan hanya dari cache lokal
