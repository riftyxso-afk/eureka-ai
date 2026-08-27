# learning-celebrations Delta

## Purpose

Umpan balik gerak (motion feedback) dan perayaan untuk momen belajar — menjawab soal, menyelesaikan uji/latihan, dan menyelesaikan misi — agar aktivitas belajar terasa hidup dan memuaskan bagi pelajar.

## ADDED Requirements

### Requirement: Animasi umpan balik saat menjawab

Sistem SHALL menampilkan animasi pop-up singkat sebagai umpan balik instan ketika pengguna menjawab soal (pilihan ganda maupun essay yang dikirim), dengan bentuk visual berbeda antara jawaban benar dan salah.

#### Scenario: Menjawab pilihan ganda benar

- **WHEN** pengguna memilih jawaban benar pada soal pilihan ganda
- **THEN** muncul animasi pop-up positif singkat (mis. centang/ledakan kecil) sebelum transisi ke soal berikutnya atau hasil akhir

#### Scenario: Menjawab pilihan ganda salah

- **WHEN** pengguna memilih jawaban salah pada soal pilihan ganda
- **THEN** muncul umpan balik visual netral-lembut (bukan hukuman keras) yang tetap mengantar pengguna melanjutkan pengerjaan

### Requirement: Perayaan penyelesaian aktivitas belajar

Sistem SHALL menampilkan animasi perayaan ketika pengguna menyelesaikan sebuah aktivitas belajar utuh — uji pemahaman, kuis, sesi belajar misi — dan intensitas/bentuk perayaan SHALL memperhitungkan konteks profil pengguna (jenjang pendidikan dan progres misi yang sedang berjalan).

#### Scenario: Menyelesaikan uji pemahaman

- **WHEN** pengguna menyelesaikan seluruh soal uji pemahaman dan hasil tampil
- **THEN** animasi perayaan diputar di atas layar hasil, dengan durasi singkat dan tidak menghalangi pembacaan skor

#### Scenario: Menyelesaikan misi belajar

- **WHEN** penyelesaian aktivitas menyebabkan sebuah misi pengguna tercapai
- **THEN** sistem menambahkan lapisan perayaan khusus pencapaian misi (mis. badge/lencana naik) setelah perayaan aktivitas dasar

#### Scenario: Skor tinggi mendapat perayaan lebih meriah

- **WHEN** pengguna menyelesaikan aktivitas dengan skor sangat baik (mis. ≥ 90% benar)
- **THEN** perayaan yang ditampilkan lebih meriah dibanding penyelesaian biasa

### Requirement: Animasi menghormati preferensi aksesibilitas

Seluruh animasi umpan balik dan perayaan SHALL dinonaktifkan atau disederhanakan menjadi transisi statis ketika pengguna mengaktifkan `prefers-reduced-motion`, dan animasi SHALL tidak pernah menghalangi interaksi (bisa dilewati/ditutup).

#### Scenario: Reduced motion aktif

- **WHEN** pengguna memiliki preferensi reduced motion aktif di sistemnya lalu menyelesaikan aktivitas
- **THEN** konfirmasi penyelesaian tetap tampil namun tanpa animasi gerak yang besar

#### Scenario: Animasi tidak memblokir interaksi

- **WHEN** animasi perayaan sedang diputar
- **THEN** pengguna dapat langsung berinteraksi dengan konten di bawahnya atau menutup/melewati animasi
