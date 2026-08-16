## Purpose

Membuat Study Buddy interaktif: saat aktif, buddy dapat menanyakan pengguna secara realtime di dalam popup — mengumpulkan konteks belajar saat mulai dan menjalankan kuis percakapan dengan opsi jawaban — dengan tampilan popup yang konsisten dengan tema clay.

## ADDED Requirements

### Requirement: Study Buddy bertanya konteks belajar saat aktif

Sistem SHALL memungkinkan Study Buddy mengajukan pertanyaan pilihan ganda untuk mengumpulkan konteks belajar (mis. target belajar, mata pelajaran, tingkat kesulitan) saat sesi aktif dimulai, dan SHALL memakai jawaban tersebut untuk menyesuaikan interaksi selanjutnya.

#### Scenario: Buddy aktif menanyakan konteks

- **WHEN** pengguna mengaktifkan Study Buddy dan belum ada konteks tersimpan
- **THEN** buddy menampilkan pertanyaan pilihan ganda (satu per satu atau berurutan) di dalam popup

#### Scenario: Jawaban konteks disimpan

- **WHEN** pengguna memilih jawaban pada pertanyaan konteks
- **THEN** jawaban tersimpan dan dipakai untuk menyesuaikan topik/kesulitan pembicaraan berikutnya

#### Scenario: Buddy tidak memaksa

- **WHEN** pengguna menutup pertanyaan konteks atau memilih lewati
- **THEN** buddy tetap bisa dipakai seperti biasa tanpa mengulang pertanyaan di sesi yang sama

### Requirement: Kuis percakapan dengan opsi jawaban

Sistem SHALL memungkinkan Study Buddy menjalankan kuis percakapan di dalam popup: buddy mengajukan soal, pengguna memilih/menulis jawaban, dan buddy memberi nilai serta penjelasan langsung di popup.

#### Scenario: Buddy mengajukan soal kuis

- **WHEN** pengguna meminta kuis atau buddy menawarkan kuis dan pengguna menerima
- **THEN** buddy menampilkan soal satu per satu dengan opsi jawaban (pilihan ganda atau jawaban singkat)

#### Scenario: Jawaban dinilai langsung

- **WHEN** pengguna menjawab soal kuis
- **THEN** buddy menampilkan benar/salah beserta penjelasan singkat sebelum lanjut ke soal berikutnya

#### Scenario: Skor akhir kuis

- **WHEN** pengguna menyelesaikan semua soal kuis
- **THEN** buddy menampilkan ringkasan skor akhir

### Requirement: Popup Study Buddy konsisten tema clay

Popup Study Buddy SHALL ditampilkan dengan gaya visual yang konsisten dengan tema clay Eureka (warna, kartu, tombol, avatar) di mode terang maupun gelap, menggantikan gaya generik yang ada.

#### Scenario: Popup bergaya clay

- **WHEN** pengguna membuka popup Study Buddy
- **THEN** popup menampilkan warna, kartu, dan kontrol sesuai tema clay dan terbaca di mode terang/gelap

#### Scenario: Pertanyaan realtime tampil jelas di popup

- **WHEN** buddy mengirim pertanyaan pilihan ganda
- **THEN** opsi jawaban tampil sebagai tombol yang jelas dan mudah diketuk di dalam popup
