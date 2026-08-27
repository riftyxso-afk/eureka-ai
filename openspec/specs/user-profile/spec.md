# user-profile Specification

## Purpose

Menjamin nama tampilan pengguna konsisten di seluruh aplikasi — profil, dashboard, home, chat, dan sidebar — dengan satu sumber kebenaran di database dan sinkronisasi sesi lokal tanpa perlu login ulang.

## Requirements

### Requirement: Satu sumber kebenaran untuk nama tampilan

Sistem SHALL menggunakan nama dari profil pengguna di database (`public.users.name` via `/api/profile`) sebagai satu-satunya sumber kebenaran nama tampilan, dan seluruh halaman aplikasi SHALL menampilkan nama dari sumber ini.

#### Scenario: Nama sama di semua halaman

- **WHEN** pengguna dengan nama tersimpan di database membuka halaman profil, dashboard, home, chat, dan sidebar
- **THEN** kelima area menampilkan nama yang sama persis dengan yang tersimpan di database

#### Scenario: Nama yang diubah langsung di database ikut tampil

- **WHEN** nama di database diperbarui (mis. lewat profil) dan pengguna me-refresh halaman
- **THEN** seluruh halaman menampilkan nama terbaru tanpa perlu keluar-masuk akun

### Requirement: Fallback nama yang benar

Sistem SHALL menampilkan nama generik yang benar ketika tidak ada nama tersimpan — tidak pernah menampilkan nama pengembang (mis. "Riftyxso"). Fallback SHALL berupa "Pengguna" atau bagian depan alamat email pengguna.

#### Scenario: Tidak ada nama tersimpan

- **WHEN** pengguna yang tidak memiliki nama di database maupun sesi membuka area login
- **THEN** aplikasi menampilkan "Pengguna" (atau bagian depan emailnya), bukan nama orang lain

### Requirement: Perubahan nama menyinkronkan semua sumber

Ketika pengguna mengubah nama di halaman profil, sistem SHALL memperbarui nama di database, memperbarui cache sesi lokal secara seketika (tanpa login ulang), dan memperbarui metadata pengguna di penyedia autentikasi agar nama tetap benar setelah refresh.

#### Scenario: Ganti nama di profil langsung terlihat di semua halaman

- **WHEN** pengguna mengganti nama di halaman profil dan menyimpan
- **THEN** halaman profil menampilkan nama baru, dan halaman dashboard/home/chat/sidebar yang dibuka berikutnya (tanpa login ulang) langsung menampilkan nama baru

#### Scenario: Refresh setelah ganti nama

- **WHEN** pengguna me-refresh halaman setelah mengganti nama
- **THEN** seluruh halaman tetap menampilkan nama baru (cache sesi disinkronkan dari database/metadata, bukan dari nilai lama)

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
