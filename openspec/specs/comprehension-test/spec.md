# comprehension-test Specification

## Purpose

Menyediakan latihan "Uji Pemahaman" di halaman catatan: AI membuat soal pilihan ganda dan essay dari materi catatan dengan jumlah dan tingkat kesulitan yang bisa diatur, dikerjakan langsung di halaman dengan penjelasan untuk jawaban salah, plus kemampuan mengunggah lembar soal (foto/scan) untuk diekstrak, dikerjakan, dan dikoreksi AI.

## Requirements

### Requirement: Tombol Uji Pemahaman di halaman catatan

Halaman catatan SHALL menampilkan kontrol "Uji Pemahaman" yang membuka alur latihan soal, terpisah dari kuis pilihan ganda biasa dan flashcards yang sudah ada.

#### Scenario: Membuka Uji Pemahaman dari halaman catatan

- **WHEN** pengguna membuka halaman catatan dan menekan kontrol "Uji Pemahaman"
- **THEN** sistem membuka antarmuka latihan untuk catatan tersebut

#### Scenario: Catatan tanpa bab

- **WHEN** pengguna membuka Uji Pemahaman pada catatan yang belum memiliki bab/isi
- **THEN** sistem menampilkan pesan bahwa catatan belum punya materi dan menyarankan membuat ulang catatan, tanpa error

### Requirement: Konfigurasi jumlah soal dan tingkat kesulitan

Sebelum soal dibuat, sistem SHALL meminta pengguna memilih jumlah soal dan tingkat kesulitan (mudah / sedang / sulit). Sistem SHALL mengirim pilihan tersebut ke generator soal dan membuat soal sesuai dengan keduanya.

#### Scenario: Memilih jumlah dan kesulitan

- **WHEN** pengguna memilih 10 soal dengan tingkat sulit lalu memulai latihan
- **THEN** sistem membuat 10 soal dari materi catatan dengan tingkat kesulitan sulit

#### Scenario: Nilai default

- **WHEN** pengguna membuka alur Uji Pemahaman tanpa mengubah pengaturan
- **THEN** sistem memakai nilai bawaan (mis. 5 soal, tingkat sedang) dan tetap menampilkan opsi yang bisa diubah

### Requirement: Tipe soal pilihan ganda (ABC) dan essay

Sistem SHALL menghasilkan dua tipe soal: pilihan ganda (dengan 4 opsi dan satu jawaban benar) dan essay (jawaban teks bebas). Sistem SHALL menampilkan dan menilai kedua tipe dalam satu sesi latihan.

#### Scenario: Soal campuran ABC dan essay

- **WHEN** pengguna memulai Uji Pemahaman dari catatan
- **THEN** sistem menghasilkan campuran soal pilihan ganda dan essay berdasarkan materi catatan

#### Scenario: Menjawab soal essay

- **WHEN** pengguna mengetik jawaban pada soal essay dan mengirimkannya
- **THEN** sistem menerima jawaban teks tersebut sebagai jawaban user untuk soal itu

### Requirement: Pengerjaan langsung di halaman dengan penilaian dan penjelasan

Pengguna SHALL dapat mengerjakan seluruh soal langsung di halaman. Setelah mengirim, sistem SHALL menampilkan skor, jawaban benar untuk tiap soal, dan untuk jawaban yang salah SHALL menampilkan penjelasan mengapa jawaban benar adalah yang dimaksud — termasuk umpan balik korektif untuk jawaban essay yang kurang tepat. Pengiriman jawaban SHALL divalidasi: pengguna diperingatkan atas soal yang belum terjawab sebelum submit, dan kegagalan penilaian essay SHALL ditampilkan eksplisit (dengan opsi coba nilai ulang) alih-alih diam-diam menurunkan skor.

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

#### Scenario: Submit dengan masih ada soal kosong

- **WHEN** pengguna menekan kirim sementara masih ada soal pilihan ganda belum dipilih atau essay kosong
- **THEN** sistem memperingatkan jumlah soal yang belum terjawab dan meminta konfirmasi sebelum menilai

#### Scenario: Penilaian essay gagal

- **WHEN** layanan penilaian essay gagal merespons atau error saat pengguna mengirim jawaban
- **THEN** sistem menampilkan pesan bahwa bagian essay belum berhasil dinilai, skor sementara hanya menghitung pilihan ganda, dan menyediakan tombol untuk mencoba menilai ulang essay tanpa mengerjakan ulang

#### Scenario: Menghentikan pembuatan soal tidak merusak state

- **WHEN** pengguna menekan "Hentikan" saat soal sedang dibuat oleh AI
- **THEN** proses pembuatan berhenti bersih dan pengguna kembali ke layar konfigurasi tanpa error atau sesi setengah jadi

### Requirement: Mengunggah lembar soal untuk diekstrak AI

Sistem SHALL menerima unggahan lembar soal berupa gambar (foto/scan) atau PDF dari pengguna pada alur Uji Pemahaman, SHALL mengekstrak soal dari berkas tersebut dengan AI, dan SHALL menampilkannya sebagai soal yang bisa dikerjakan di halaman dengan tipe yang sama (pilihan ganda/essay) serta dinilai dengan penjelasan.

#### Scenario: Upload foto lembar soal

- **WHEN** pengguna mengunggah foto lembar soal (gambar) pada alur Uji Pemahaman
- **THEN** sistem mengekstrak soal dari gambar dan menampilkan daftar soal yang bisa dikerjakan di halaman

#### Scenario: Upload PDF lembar soal

- **WHEN** pengguna mengunggah berkas PDF berisi soal
- **THEN** sistem mengekstrak soal dari PDF dan menampilkannya sebagai soal yang bisa dikerjakan

#### Scenario: Lembar soal tidak terbaca

- **WHEN** pengguna mengunggah berkas yang tidak mengandung soal yang dapat diekstrak (mis. gambar buram tanpa teks jelas)
- **THEN** sistem menampilkan pesan bahwa soal tidak terbaca dan mengizinkan mencoba unggah ulang, tanpa error

#### Scenario: Jawaban lembar soal dikoreksi

- **WHEN** pengguna mengerjakan soal hasil unggahan lalu mengirim
- **THEN** sistem mengoreksi tiap jawaban (benar/salah/kurang tepat) dan menampilkan penjelasan untuk jawaban yang salah, sama seperti soal yang dibuat dari materi catatan
