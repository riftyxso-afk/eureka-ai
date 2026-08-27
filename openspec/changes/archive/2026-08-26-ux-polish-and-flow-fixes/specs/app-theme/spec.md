# app-theme Delta

## MODIFIED Requirements

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
