# user-profile Delta

## ADDED Requirements

### Requirement: Data onboarding tersinkron dengan profil

Halaman profil SHALL membaca dan menulis data onboarding (jenjang pendidikan, kelas) menggunakan kosakata nilai yang sama persis dengan alur onboarding, sehingga tidak ada nilai yang tampak kosong atau tertimpa label berbeda saat disimpan dari profil.

#### Scenario: Kelas dari onboarding tampil benar di profil

- **WHEN** pengguna menyelesaikan onboarding dengan jenjang SMA kelas 10 lalu membuka halaman profil
- **THEN** pilihan jenjang dan kelas di profil menampilkan "SMA / kelas 10" sesuai nilai tersimpan, bukan kosong

#### Scenario: Menyimpan profil tidak merusak kelas

- **WHEN** pengguna mengubah nama/sekolah di profil dan menyimpan tanpa mengubah kelas
- **THEN** nilai kelas dan jenjang tersimpan tetap utuh dalam kosakata onboarding (tidak tertimpa format label lain)

### Requirement: Jenjang pendidikan dapat diubah di profil

Halaman profil SHALL memungkinkan pengguna mengubah jenjang pendidikan (SD/SMP/SMA/mahasiswa), dan pilihan kelas yang tersedia SHALL menyesuaikan jenjang yang dipilih, sama seperti aturan opsi pada onboarding.

#### Scenario: Ganti jenjang dari SMA ke mahasiswa

- **WHEN** pengguna mengubah jenjang pendidikan menjadi mahasiswa di profil
- **THEN** daftar pilihan kelas berganti menjadi opsi semester mahasiswa dan nilai lama tidak lagi dikirim sebagai kelas SMA

### Requirement: Hasil analisis onboarding terlihat di profil

Halaman profil SHALL menampilkan ringkasan hasil onboarding (jenis kepribadian belajar, topik lemah, kebiasaan belajar, jam belajar puncak) sebagai informasi yang terbaca, meskipun tidak semuanya harus dapat diedit.

#### Scenario: Melihat ringkasan kepribadian belajar

- **WHEN** pengguna yang telah menyelesaikan onboarding membuka halaman profil
- **THEN** profil menampilkan ringkasan hasil analisis onboarding tersebut
