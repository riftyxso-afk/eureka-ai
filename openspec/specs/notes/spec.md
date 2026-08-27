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
