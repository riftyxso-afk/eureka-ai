## MODIFIED Requirements

### Requirement: Tombol Uji Pemahaman di halaman catatan

Halaman catatan SHALL menampilkan kontrol "Uji Pemahaman" yang **menavigasi pengguna ke halaman interaktif latihan** (`/dashboard/note/[id]/uji-pemahaman`), terpisah dari kuis pilihan ganda biasa dan flashcards yang sudah ada. Kontrol ini SHALL tidak lagi membuka modal/popup.

#### Scenario: Membuka Uji Pemahaman dari halaman catatan

- **WHEN** pengguna membuka halaman catatan dan menekan kontrol "Uji Pemahaman"
- **THEN** sistem menavigasi ke halaman `/dashboard/note/[id]/uji-pemahaman` yang menampilkan antarmuka latihan untuk catatan tersebut

#### Scenario: Catatan tanpa bab

- **WHEN** pengguna membuka Uji Pemahaman pada catatan yang belum memiliki bab/isi
- **THEN** halaman menampilkan pesan bahwa catatan belum punya materi dan menyarankan membuat ulang catatan, tanpa error

### Requirement: Pengerjaan langsung di halaman dengan penilaian dan penjelasan

Pengguna SHALL dapat mengerjakan seluruh soal langsung di **halaman interaktif Uji Pemahaman** (bukan modal). Setelah mengirim, sistem SHALL menampilkan skor, jawaban benar untuk tiap soal, dan untuk jawaban yang salah SHALL menampilkan penjelasan mengapa jawaban benar adalah yang dimaksud — termasuk umpan balik korektif untuk jawaban essay yang kurang tepat.

#### Scenario: Jawaban pilihan ganda salah

- **WHEN** pengguna memilih jawaban yang salah pada soal pilihan ganda lalu mengirim
- **THEN** sistem menampilkan jawaban benar dan penjelasan singkat materi yang mendukung jawaban tersebut

#### Scenario: Jawaban pilihan ganda benar

- **WHEN** pengguna memilih jawaban yang benar pada soal pilihan ganda lalu mengirim
- **THEN** sistem menandai jawaban benar dan tetap menampilkan penjelasan singkat

#### Scenario: Jawaban essay dinilai

- **WHEN** pengguna mengirim jawaban essay
- **THEN** sistem menilai kebenarannya terhadap materi, menandai benar/salah/kurang tepat, dan menampilkan jawaban acuan beserta penjelasan koreksi

#### Scenario: Skor akhir ditampilkan

- **WHEN** pengguna menyelesaikan semua soal dalam satu sesi
- **THEN** sistem menampilkan skor akhir (mis. jumlah benar dari total soal)

## ADDED Requirements

### Requirement: Halaman interaktif Uji Pemahaman

Sistem SHALL menyediakan halaman khusus `/dashboard/note/[id]/uji-pemahaman` (di dalam area login) yang menampung seluruh alur latihan: pemilihan mode (dari materi catatan / upload lembar soal), pengaturan jumlah & tingkat kesulitan, area pembuatan soal, pengerjaan, dan hasil. Halaman SHALL dapat diakses dari tombol "Uji Pemahaman" di halaman catatan dan SHALL menampilkan judul catatan sebagai konteks.

#### Scenario: Membuka halaman uji pemahaman langsung

- **WHEN** pengguna membuka `/dashboard/note/[id]/uji-pemahaman` untuk catatan yang valid
- **THEN** halaman menampilkan alur latihan lengkap untuk catatan tersebut (mode, pengaturan, dan area latihan), dengan judul catatan terlihat

#### Scenario: Kembali ke halaman catatan

- **WHEN** pengguna menekan kontrol kembali di halaman uji pemahaman
- **THEN** sistem menavigasi kembali ke halaman catatan (`/dashboard/note/[id]`)

#### Scenario: Catatan tidak ditemukan

- **WHEN** pengguna membuka halaman uji pemahaman untuk catatan yang tidak ada atau tidak berhak diakses
- **THEN** halaman menampilkan pesan catatan tidak ditemukan dan tautan kembali ke dashboard, tanpa error

### Requirement: Streaming realtime saat AI menulis soal

Ketika soal dibuat dari materi catatan, sistem SHALL menampilkan token jawaban AI secara **realtime** (streaming) sebagai teks yang sedang ditulis — bukan spinner statis — dan setelah AI selesai, sistem SHALL mengubah teks tersebut menjadi soal terstruktur yang siap dikerjakan di halaman yang sama.

#### Scenario: AI sedang menulis soal

- **WHEN** pengguna memulai pembuatan soal dan AI mulai merespons
- **THEN** halaman menampilkan teks respons AI yang bertambah secara realtime (efek mengetik) dengan indikator bahwa AI sedang menulis soal

#### Scenario: Transisi ke mode pengerjaan setelah selesai

- **WHEN** respons AI selesai dan soal berhasil di-parse
- **THEN** halaman mengganti area teks realtime dengan daftar soal terstruktur (pilihan ganda/essay) yang siap dikerjakan

#### Scenario: Respons AI tidak valid

- **WHEN** respons AI selesai tetapi tidak menghasilkan soal yang valid (mis. JSON rusak atau kosong)
- **THEN** halaman menampilkan pesan kegagalan yang jelas dengan opsi mencoba lagi, tanpa menghilangkan teks yang sudah ditampilkan secara paksa

#### Scenario: Streaming gagal di tengah jalan

- **WHEN** koneksi streaming terputus sebelum respons selesai
- **THEN** halaman menampilkan pesan bahwa pembuatan soal terputus dan mengizinkan mencoba lagi
