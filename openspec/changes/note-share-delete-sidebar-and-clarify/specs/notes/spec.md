## ADDED Requirements

### Requirement: Bagikan catatan via link publik read-only

Sistem SHALL memungkinkan pemilik catatan membuat link publik unik untuk catatannya. Siapa pun yang membuka link SHALL melihat isi catatan (judul dan bab) dalam mode read-only tanpa perlu login, tanpa akses ke tombol edit, hapus, atau alat yang mengubah data. Pemilik catatan SHALL tetap dapat mengedit dan membaca catatan lewat akunnya seperti biasa.

#### Scenario: Pemilik membuat link share

- **WHEN** pemilik menekan tombol bagikan pada halaman catatan
- **THEN** sistem membuat token unik yang tidak bisa ditebak dan menampilkan link publik untuk disalin

#### Scenario: Pembuka link melihat catatan read-only

- **WHEN** seseorang yang tidak login membuka link share catatan
- **THEN** halaman menampilkan judul dan bab catatan secara lengkap, tanpa kontrol edit/hapus/komposer apa pun

#### Scenario: Pemilik tetap bisa edit lewat akunnya

- **WHEN** pemilik membuka halaman catatannya di dashboard setelah membuat link share
- **THEN** pemilik tetap dapat mengedit dan membaca catatan seperti sebelum dibagikan

#### Scenario: Token tidak dikenal

- **WHEN** seseorang membuka link share dengan token yang tidak terdaftar atau sudah dinonaktifkan
- **THEN** sistem menampilkan halaman tidak ditemukan yang jelas

### Requirement: Hapus catatan beserta data terkait

Sistem SHALL memungkinkan pemilik menghapus catatan secara permanen. Penghapusan SHALL menghapus catatan beserta seluruh data terkaitnya (bab, potongan RAG, gambar, kolaborator, catatan papan, kartu hafalan, versi, dan link share) dan SHALL hanya bisa dilakukan oleh pemilik catatan.

#### Scenario: Pemilik menghapus catatan dengan konfirmasi

- **WHEN** pemilik menekan hapus pada halaman catatan atau kartu catatan di dashboard dan mengonfirmasi
- **THEN** sistem menghapus catatan beserta semua data terkait dan catatan tidak lagi muncul di dashboard

#### Scenario: Penghapusan dibatalkan

- **WHEN** pemilik menekan hapus tetapi membatalkan dialog konfirmasi
- **THEN** catatan dan semua datanya tetap utuh

#### Scenario: Bukan pemilik tidak bisa menghapus

- **WHEN** pengguna yang bukan pemilik mencoba menghapus catatan (langsung via API)
- **THEN** sistem menolak dengan status tidak diizinkan dan catatan tetap ada
