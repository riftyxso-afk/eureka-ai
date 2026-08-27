# app-theme Specification

## Purpose

Menyediakan mode gelap untuk area login (halaman terautentikasi) dengan toggle manual dan mengikuti preferensi sistem, sementara halaman publik (landing, login, register) tetap tampil terang.

## Requirements

### Requirement: Toggle mode gelap di area login

Sistem SHALL menyediakan kontrol untuk beralih antara tema terang dan gelap pada halaman area login, dan SHALL menyimpan pilihan pengguna agar bertahan setelah refresh dan lintas halaman.

#### Scenario: Beralih tema dari area login

- **WHEN** pengguna menekan toggle tema di salah satu halaman area login (mis. sidebar atau pengaturan)
- **THEN** seluruh halaman area login langsung beralih ke tema yang dipilih dan pilihan tersimpan untuk kunjungan berikutnya

#### Scenario: Pilihan bertahan setelah refresh

- **WHEN** pengguna memilih mode gelap lalu me-refresh halaman
- **THEN** aplikasi tetap menampilkan mode gelap sesuai pilihan tersimpan

### Requirement: Mengikuti preferensi sistem saat pertama kali

Sistem SHALL menentukan tema awal berdasarkan preferensi sistem operasi pengguna (`prefers-color-scheme`) selama pengguna belum memilih tema secara eksplisit.

#### Scenario: OS gelap tanpa pilihan eksplisit

- **WHEN** pengguna baru membuka area login pada perangkat dengan mode gelap sistem aktif dan belum pernah memilih tema
- **THEN** aplikasi menampilkan mode gelap

#### Scenario: OS terang tanpa pilihan eksplisit

- **WHEN** pengguna baru membuka area login pada perangkat dengan mode terang sistem dan belum pernah memilih tema
- **THEN** aplikasi menampilkan mode terang

### Requirement: Halaman publik tetap terang

Mode gelap SHALL hanya berlaku pada halaman area login; halaman publik (landing, login, register) SHALL tetap ditampilkan dengan tema terang apa pun pilihan tema pengguna.

#### Scenario: Landing dan auth tidak terpengaruh tema

- **WHEN** pengguna yang memilih mode gelap membuka halaman `/`, `/login`, atau `/register`
- **THEN** halaman-halaman tersebut tetap tampil terang

### Requirement: Keterbacaan dan kontras di mode gelap

Seluruh teks, input, kartu, dan kontrol interaktif di area login SHALL tetap terbaca dan dapat dibedakan ketika mode gelap aktif (kontras latar-teks memadai, elemen interaktif tidak menyatu dengan latar). Cakupan mode gelap SHALL menyeluruh: setiap permukaan halaman area login — termasuk halaman yang memakai warna hardcoded, modal, pop-up, overlay, skeleton loader, komponen catatan/chat/kuis/jadwal/profil/ujian, dan konten markdown hasil AI — SHALL ikut beralih ke tema gelap; TIDAK BOLEH ada permukaan yang tetap terang ("bocor terang") saat mode gelap aktif.

#### Scenario: Konten terbaca di mode gelap

- **WHEN** mode gelap aktif di halaman area login
- **THEN** teks utama kontras terhadap latar gelap, dan kartu/input/tombol tetap dapat dibedakan dari latar belakang

#### Scenario: Modal dan pop-up ikut gelap

- **WHEN** pengguna membuka modal/pop-up apa pun (buat catatan, bagikan, flashcard, kuis, konfirmasi) saat mode gelap aktif
- **THEN** seluruh modal tampil dalam tema gelap tanpa panel putih tersisa

#### Scenario: Halaman detail catatan tidak bocor terang

- **WHEN** pengguna menelusuri halaman detail catatan, bab, uji pemahaman, jadwal, profil, ujian, dan leaderboard dalam mode gelap
- **THEN** semua halaman tersebut tampil gelap penuh; tidak ada kartu, input, atau blok konten yang tetap berlatar terang

#### Scenario: Konten AI tetap terbaca

- **WHEN** jawaban/markdown hasil AI dirender pada mode gelap (termasuk tabel, blok kode, dan kutipan)
- **THEN** seluruh elemen render menggunakan warna tema gelap dan tetap kontras terbaca
