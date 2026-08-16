## Purpose

Membuat mata pelajaran menjadi data milik per-user: akun baru mulai dengan daftar kosong, pengguna menambah subjeknya sendiri, dan subjek milik satu pengguna tidak pernah terlihat atau dapat diakses pengguna lain.

## ADDED Requirements

### Requirement: Akun baru mulai dengan daftar subjek kosong

Sistem SHALL menampilkan daftar mata pelajaran kosong untuk akun yang baru dibuat — tidak ada subjek bawaan/seed yang otomatis muncul. Pengguna SHALL menambahkan subjeknya sendiri.

#### Scenario: Akun baru membuka halaman Mata Pelajaran

- **WHEN** pengguna baru (baru mendaftar) membuka halaman mata pelajaran
- **THEN** daftar subjek kosong dan sistem menampilkan ajakan untuk menambah subjek pertama

#### Scenario: Tidak ada subjek bawaan

- **WHEN** pengguna baru membuka alur buat catatan yang menampilkan pilihan mata pelajaran
- **THEN** tidak ada subjek default yang muncul; pengguna harus memilih dari subjek miliknya sendiri atau menambah yang baru

### Requirement: Subjek bersifat per-user (isolasi antar-akun)

Setiap subjek SHALL dimiliki oleh satu pengguna (`user_id`), dan sistem SHALL hanya menampilkan serta mengizinkan perubahan (tambah, hapus, ubah) pada subjek milik pengguna yang sedang login. Subjek milik pengguna lain SHALL tidak pernah tampil maupun dapat diakses.

#### Scenario: Subjek user A tidak tampil di user B

- **WHEN** pengguna A menambah subjek "Teknologi" lalu pengguna B (akun berbeda) membuka halaman mata pelajaran
- **THEN** subjek "Teknologi" milik A tidak muncul di daftar B, dan B tidak bisa melihat/menghapus/mengubahnya

#### Scenario: Dua pengguna menambah subjek dengan nama sama

- **WHEN** pengguna A dan pengguna B masing-masing menambah subjek bernama "Matematika"
- **THEN** kedua subjek tersimpan terpisah sebagai milik masing-masing, tanpa konflik, dan masing-masing hanya melihat subjeknya sendiri

#### Scenario: Endpoint subjek hanya mengembalikan data sendiri

- **WHEN** API subjek dipanggil dengan identitas pengguna tertentu
- **THEN** respons hanya berisi subjek milik pengguna tersebut, bukan subjek pengguna lain

### Requirement: Pembersihan subjek global lama

Subjek seed/global yang sebelumnya tampil ke semua pengguna (mis. 6 subjek bawaan dan subjek yang ditambahkan sebelum fitur per-user) SHALL dihapus dari data bersama sehingga tidak lagi muncul di akun mana pun. Catatan yang sudah ada SHALL tetap utuh — kolom subjek pada catatan (teks) tidak dihapus dan catatan tetap bisa diakses.

#### Scenario: Subjek global lama tidak muncul lagi

- **WHEN** pengguna yang sebelumnya melihat subjek bawaan membuka halaman mata pelajaran setelah migrasi
- **THEN** daftar hanya menampilkan subjek yang benar-benar miliknya (atau kosong), tanpa subjek global lama

#### Scenario: Catatan lama tetap utuh

- **WHEN** migrasi pembersihan subjek global dijalankan
- **THEN** catatan lama yang memiliki nilai subjek teks (mis. "Matematika") tetap ada, dapat dibuka, dan nilai subjeknya tidak berubah
