# Spec Delta: notes

## ADDED Requirements

### Requirement: Transparansi langkah pembuatan catatan secara real-time

Selama catatan dibuat, sistem SHALL menampilkan daftar langkah yang sedang dan sudah dikerjakan AI, diperbarui secara real-time dari kemajuan proses yang sebenarnya — bukan animasi/mock berbasis waktu. Setiap langkah menampilkan label aksi dalam bahasa Indonesia dan detail pendek; langkah yang sedang berjalan ditandai jelas dan langkah yang selesai mendapat tanda sukses.

#### Scenario: Langkah muncul sesuai kemajuan nyata

- **WHEN** user memulai pembuatan catatan (dari chat maupun dashboard)
- **THEN** baris langkah baru muncul di tampilan loading hanya ketika proses benar-benar memasuki langkah tersebut, dalam urutan yang sama dengan urutan kerja pipeline

#### Scenario: Langkah selesai ditandai

- **WHEN** satu langkah pipeline selesai
- **THEN** baris langkah tersebut berubah menjadi status selesai (tanda ceklis) dan langkah berikutnya mulai ditandai aktif

#### Scenario: Tidak ada langkah palsu

- **WHEN** proses pembuatan catatan berjalan
- **THEN** tidak ada baris langkah yang muncul atau ditandai selesai hanya karena timer/animasi — semua transisi langkah dipicu event kemajuan dari server

### Requirement: Detail langkah dapat diperluas

Setiap baris langkah SHALL dapat diperluas untuk memperlihatkan detail apa yang dikerjakan pada langkah itu (mis. judul bab yang sedang disusun, hasil pencarian web), dan daftar langkah SHALL dapat diciutkan/dikembangkan sebagai satu kesatuan.

#### Scenario: Expand baris langkah

- **WHEN** user mengklik baris langkah yang memiliki detail
- **THEN** detail langkah tampil di bawah baris tersebut; klik lagi menyembunyikannya kembali

#### Scenario: Ciutkan daftar langkah

- **WHEN** user mengeklik header daftar langkah
- **THEN** seluruh daftar tersembunyi menyisakan header ringkas, dan klik berikutnya mengembalikannya

### Requirement: Persen dan pesan ringkas tetap tersedia

Tampilan loading SHALL tetap menampilkan kemajuan persen keseluruhan dan satu pesan ringkas seperti sebelumnya; daftar langkah bersifat tambahan, bukan pengganti.

#### Scenario: Overlay dari chat

- **WHEN** user meminta "buat catatan" dari percakapan chat
- **THEN** overlay menampilkan persen, pesan ringkas, DAN daftar langkah real-time sekaligus

#### Scenario: Modal dashboard

- **WHEN** user membuat catatan dari modal dashboard
- **THEN** modal menampilkan persen, pesan ringkas, DAN daftar langkah real-time sekaligus

### Requirement: Event kemajuan membawa informasi langkah

Server SHALL menyertakan identitas dan status langkah pada setiap event kemajuan pembuatan catatan, dengan format aditif yang tidak merusak klien lama yang hanya membaca persen dan pesan.

#### Scenario: Klien lama tidak rusak

- **WHEN** klien lama yang hanya membaca `percent` dan `message` menerima event kemajuan baru
- **THEN** klien tersebut tetap berfungsi seperti sebelumnya (informasi langkah diabaikan)

#### Scenario: Klien baru menerima langkah

- **WHEN** klien menerima event kemajuan selama pembuatan catatan
- **THEN** event memuat cukup informasi untuk mengetahui langkah mana yang mulai, mana yang selesai, beserta label dan detailnya

### Requirement: Pemulihan saat stream terputus

Bila koneksi kemajuan real-time terputus di tengah proses, tampilan langkah SHALL pulih ke keadaan yang konsisten — langkah yang sudah selesai sebelum putus tidak hilang, dan daftar melanjutkan pembaruan saat koneksi tersambung lagi.

#### Scenario: Sambungan putus dan tersambung lagi

- **WHEN** stream kemajuan terputus sementara lalu klien tersambung ulang
- **THEN** daftar langkah menampilkan semua langkah yang sudah sempat selesai dan melanjutkan pembaruan dari titik terakhir
