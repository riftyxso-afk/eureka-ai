# notes Delta

## ADDED Requirements

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
