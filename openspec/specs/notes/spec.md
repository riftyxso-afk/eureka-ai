# notes Specification

## Purpose

Memungkinkan pengguna menyematkan (pin) catatan agar tampil paling atas di dashboard, dengan status pin yang tersimpan di database dan konsisten lintas perangkat.

## Requirements

### Requirement: Pin dan unpin catatan dari dashboard

Sistem SHALL memungkinkan pengguna menyematkan dan melepas sematan catatan dari kartu catatan di dashboard, dan SHALL menyimpan status pin per catatan per pengguna di database.

#### Scenario: Menyematkan catatan

- **WHEN** pengguna menekan kontrol pin pada kartu catatan
- **THEN** status catatan berubah menjadi tersemat, tersimpan di database, dan indikator pin pada kartu berubah

#### Scenario: Melepas sematan catatan

- **WHEN** pengguna menekan kontrol pin pada catatan yang sudah tersemat
- **THEN** status catatan menjadi tidak tersemat dan tersimpan di database

### Requirement: Catatan tersemat tampil paling atas

Sistem SHALL menampilkan catatan tersemat di bagian atas daftar catatan dashboard, sebelum catatan yang tidak tersemat, pada semua mode penyortiran yang tersedia.

#### Scenario: Daftar catatan dengan campuran pin dan non-pin

- **WHEN** pengguna membuka dashboard dengan beberapa catatan tersemat dan beberapa tidak
- **THEN** semua catatan tersemat tampil paling atas (urutan antar-catatan tersemat mengikuti urutan normal), disusul catatan tidak tersemat

#### Scenario: Filter pencarian tidak menghilangkan urutan pin

- **WHEN** pengguna mencari catatan dengan kata kunci tertentu
- **THEN** hasil yang cocok tetap menampilkan catatan tersemat di atas catatan tidak tersemat

### Requirement: Pin persisten lintas perangkat

Status pin catatan SHALL tersimpan di database sehingga tetap berlaku ketika pengguna membuka dashboard dari perangkat atau sesi lain dengan akun yang sama.

#### Scenario: Pin terlihat di perangkat lain

- **WHEN** pengguna menyematkan catatan lalu membuka dashboard dari perangkat lain dengan akun yang sama
- **THEN** catatan tersebut tetap tampil tersemat dan berada di atas daftar

### Requirement: Pembuatan catatan dari banyak sumber

Sistem SHALL memungkinkan pengguna membuat satu catatan dari beberapa sumber sekaligus — hingga 5 sumber — dengan kombinasi bebas antara dokumen (PDF/DOCX/PPTX/TXT), link YouTube, dan link web. Sistem SHALL mengekstrak konten dari semua sumber, menggabungkannya, dan mengolahnya menjadi satu catatan utuh.

#### Scenario: Dua dokumen digabung

- **WHEN** pengguna memilih 2 file dokumen (mis. dua PDF) sebagai sumber lalu membuat catatan
- **THEN** konten kedua dokumen diekstrak dan digabung menjadi satu catatan yang memuat materi dari keduanya

#### Scenario: YouTube dan web digabung

- **WHEN** pengguna memilih 1 link YouTube dan 1 link web sebagai sumber lalu membuat catatan
- **THEN** subtitle YouTube dan konten halaman web digabung menjadi satu catatan yang memuat materi dari keduanya

#### Scenario: Campuran dokumen, YouTube, dan web

- **WHEN** pengguna memilih campuran dokumen + link YouTube + link web sebagai sumber (total ≤ 5)
- **THEN** seluruh sumber diproses menjadi satu catatan yang memuat materi gabungan

#### Scenario: Lebih dari 5 sumber ditolak

- **WHEN** pengguna mencoba menambahkan sumber ke-6 atau lebih
- **THEN** sistem menolak penambahan dengan pesan jelas bahwa maksimal 5 sumber, tanpa mengganggu sumber yang sudah dipilih

#### Scenario: Satu sumber tetap berfungsi seperti biasa

- **WHEN** pengguna membuat catatan dari satu sumber saja (dokumen ATAU YouTube ATAU web)
- **THEN** alur dan hasil sama seperti perilaku sebelumnya

### Requirement: Informasi sumber dan validasi multi-sumber

Sistem SHALL menampilkan ringkasan sumber yang dipilih sebelum pembuatan (jenis & nama/URL tiap sumber), SHALL memvalidasi bahwa setidaknya satu sumber terisi dan setiap link/file valid, dan SHALL menampilkan error yang spesifik ketika ada sumber yang gagal diproses.

#### Scenario: Ringkasan sumber ditampilkan

- **WHEN** pengguna telah memilih beberapa sumber di alur pembuatan catatan
- **THEN** sistem menampilkan daftar sumber terpilih (jenis + nama/URL) dan pengguna bisa menghapus salah satu sebelum mulai

#### Scenario: Tidak ada sumber terisi

- **WHEN** pengguna menekan mulai membuat tanpa mengisi sumber apa pun
- **THEN** sistem menampilkan error bahwa minimal satu sumber diperlukan

#### Scenario: Satu sumber gagal diproses

- **WHEN** salah satu dari beberapa sumber gagal diekstrak (mis. link web mati atau file korup) tetapi sumber lain valid
- **THEN** sistem memberi tahu sumber mana yang gagal dan tetap memproses sumber yang valid (atau membatalkan sesuai keputusan pengguna), tanpa diam-diam mengabaikan sumber yang gagal

### Requirement: Catatan hasil gabungan tetap mendukung alat belajar

Catatan yang dibuat dari banyak sumber SHALL tetap memiliki struktur bab normal dan SHALL tetap mendukung alat belajar yang ada — kuis, flashcards, dan uji pemahaman — yang membaca materi dari bab catatan.

#### Scenario: Kuis dari catatan gabungan

- **WHEN** pengguna membuat kuis dari catatan yang berasal dari beberapa sumber
- **THEN** soal kuis dibuat dari materi gabungan semua sumber, bukan hanya salah satu sumber

### Requirement: Stabilo AI menandai poin penting tanpa kacau

Sistem SHALL menghasilkan stabilo otomatis (userId "ai") yang hanya menandai poin-poin penting dari isi bab catatan, dengan pencocokan teks yang ketat ke konten asli, panjang segmen yang wajar, tanpa tumpang tindih antar-highlight, dan kepadatan yang dijaga agar tidak seluruh teks tersorot.

#### Scenario: Teks hasil AI cocok persis dengan konten bab

- **WHEN** AI mengembalikan kandidat stabilo yang teksnya cocok persis (dengan perbedaan spasi/gaya saja) dengan isi bab
- **THEN** stabilo disimpan dengan teks persis dari konten bab dan tampil tersorot pada posisi yang benar

#### Scenario: Teks hasil AI tidak cocok dengan konten bab

- **WHEN** kandidat stabilo dari AI tidak ditemukan di isi bab (termasuk setelah normalisasi spasi)
- **THEN** kandidat tersebut diabaikan dan TIDAK menghasilkan stabilo di kalimat lain yang mirip, sehingga tidak ada sorotan di tempat yang tidak dimaksud

#### Scenario: Kandidat terlalu pendek atau terlalu panjang

- **WHEN** kandidat stabilo lebih pendek dari batas minimum atau lebih panjang dari batas maksimum panjang segmen
- **THEN** kandidat diabaikan, sehingga stabilo tetap berupa frasa/kalimat singkat dan bukan paragraf utuh

#### Scenario: Dua kandidat saling tumpang tindih pada bab yang sama

- **WHEN** dua kandidat stabilo pada bab yang sama saling beririsan atau satu menjadi bagian dari yang lain
- **THEN** hanya satu yang disimpan (yang lebih panjang/prioritas), sehingga sorotan tidak bertumpuk dan tampilan tetap rapi

#### Scenario: Kepadatan stabilo dibatasi

- **WHEN** jumlah stabilo pada satu bab atau satu catatan melebihi batas kepadatan
- **THEN** kelebihan kandidat diabaikan sehingga hanya sebagian kecil teks yang tersorot, tidak hampir seluruh isi catatan

#### Scenario: Regenerasi stabilo tidak menggandakan

- **WHEN** pengguna menjalankan stabilo AI lagi pada catatan yang sudah memiliki stabilo AI
- **THEN** stabilo AI lama dihapus lalu yang baru disimpan tanpa duplikat, dan jumlah total stabilo tetap dalam batas

### Requirement: Thumbnail/sampul pada kartu catatan dashboard

Setiap kartu catatan di dashboard SHALL menampilkan sampul visual (thumbnail) — berupa blok warna khas mata pelajaran beserta ikon — sehingga daftar catatan dapat dibedakan sekilas tanpa membaca judul; kartu TIDAK SHALL lagi tampil seragam satu warna untuk semua mata pelajaran.

#### Scenario: Kartu catatan perlihatkan warna mapel

- **WHEN** pengguna membuka dashboard dengan catatan dari beberapa mata pelajaran
- **THEN** tiap kartu menampilkan sampul berwarna sesuai mata pelajaran catatannya dengan ikon yang mewakili

#### Scenario: Catatan tanpa mata pelajaran

- **WHEN** catatan tidak memiliki mata pelajaran terdeteksi
- **THEN** kartu memakai warna sampul netral bawaan dan tetap tampil rapi

### Requirement: Jawaban AI terikat konteks catatan

Tanya-jawab AI pada catatan SHALL hanya menjawab berdasarkan materi catatan terkait; ketika pertanyaan berada di luar cakupan materi, sistem SHALL menolak dengan sopan dan mengarahkan kembali ke materi, bukan menjawab umum dari pengetahuan luasnya.

#### Scenario: Pertanyaan di luar materi ditolak

- **WHEN** pengguna bertanya hal yang tidak ada hubungannya dengan isi catatan pada chat AI catatan
- **THEN** asisten menyatakan bahwa pertanyaan di luar materi catatan dan menyarankan pertanyaan seputar materi

#### Scenario: Catatan masih diproses diberi state jelas

- **WHEN** pengguna bertanya pada catatan yang materinya masih dalam proses olah AI dan belum siap
- **THEN** sistem menampilkan status "catatan sedang disiapkan" dengan indikator progres, bukan error generik yang bisa di-retry tanpa akhir

#### Scenario: Pertanyaan lanjutan tetap dalam konteks

- **WHEN** pengguna mengajukan pertanyaan lanjutan merujuk percakapan sebelumnya pada chat AI catatan
- **THEN** asisten memperhitungkan riwayat percakapan sesaat itu sehingga jawaban tetap nyambung dan tetap terikat materi catatan

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
