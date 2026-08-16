## Purpose

Meningkatkan kualitas jawaban AI di chat asisten dengan mendeteksi prompt yang ambigu dan mengajukan maksimal 4 pertanyaan pilihan ganda kepada pengguna sebelum AI menjawab, sehingga prompt menjadi lebih jelas dan hasilnya lebih valid.

## ADDED Requirements

### Requirement: Deteksi prompt ambigu di chat asisten

Sistem SHALL menilai prompt yang dikirim pengguna di halaman chat asisten dan menentukan apakah prompt tersebut ambigu sehingga butuh klarifikasi sebelum dijawab. Penilaian SHALL dilakukan per pesan dan tidak mengganggu prompt yang sudah jelas.

#### Scenario: Prompt jelas langsung dijawab

- **WHEN** pengguna menulis prompt yang jelas dan lengkap (mis. "Jelaskan fotosintesis")
- **THEN** sistem langsung memproses dan menjawab tanpa pertanyaan klarifikasi

#### Scenario: Prompt ambigu memicu klarifikasi

- **WHEN** pengguna menulis prompt yang ambigu (mis. "buatkan soal matematika" tanpa jenjang/topik)
- **THEN** sistem menampilkan maksimal 4 pertanyaan klarifikasi pilihan ganda sebelum menghasilkan jawaban akhir

### Requirement: Pertanyaan klarifikasi pilihan ganda

Sistem SHALL menampilkan pertanyaan klarifikasi sebagai pilihan ganda dengan 2–4 opsi per pertanyaan, maksimal 4 pertanyaan per prompt. Pengguna SHALL bisa menjawab sebagian/semua pertanyaan atau memilih untuk langsung menjawab tanpa klarifikasi.

#### Scenario: Menjawab pertanyaan klarifikasi

- **WHEN** pengguna memilih opsi jawaban pada pertanyaan klarifikasi
- **THEN** jawaban tercatat dan pertanyaan berikutnya tetap ditampilkan sampai semua pertanyaan dijawab atau pengguna memilih lanjut

#### Scenario: Lewati klarifikasi

- **WHEN** pengguna memilih untuk langsung menjawab tanpa mengisi klarifikasi
- **THEN** sistem tetap memproses prompt dengan informasi yang tersedia

#### Scenario: Batas jumlah pertanyaan

- **WHEN** sistem menilai prompt sangat ambigu
- **THEN** sistem tetap tidak menampilkan lebih dari 4 pertanyaan dalam satu kali klarifikasi

### Requirement: Jawaban klarifikasi dipakai untuk menjawab

Sistem SHALL menggunakan jawaban klarifikasi pengguna sebagai konteks tambahan saat menghasilkan jawaban akhir, sehingga jawaban sesuai dengan maksud pengguna.

#### Scenario: Jawaban memengaruhi hasil

- **WHEN** pengguna menjawab klarifikasi (mis. "jenjang SMP", "topik aljabar")
- **THEN** jawaban akhir AI mempertimbangkan informasi tersebut dan tidak mengulangi pertanyaan yang sama

#### Scenario: Tanpa jawaban, jawaban tetap dihasilkan

- **WHEN** pengguna melewati klarifikasi tanpa menjawab
- **THEN** AI tetap menjawab dengan asumsi wajar dari prompt asli
