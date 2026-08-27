# comprehension-test Delta

## MODIFIED Requirements

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
