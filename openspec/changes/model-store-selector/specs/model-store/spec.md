# Spec Delta: model-store

## ADDED Requirements

### Requirement: Katalog model dengan logo dan peringkat kecerdasan

Sistem SHALL menyediakan katalog model AI yang menampilkan untuk setiap model: logo brand, nama model, tier kecepatan (Kilat/Seimbang/Mendalam), dan peringkat kecerdasan pada skala "sedikit pintar → terpintar" dengan keterangan singkat berbahasa Indonesia. Katalog memuat seluruh model yang tersedia untuk dipilih, termasuk model di luar tier aktif.

#### Scenario: User membuka Model Store

- **WHEN** user membuka pemilih model di composer chat
- **THEN** sistem menampilkan daftar model dengan logo, nama, tier, dan peringkat kecerdasan, terurut dari sedikit pintar ke terpintar

#### Scenario: Model tanpa logo brand khusus

- **WHEN** sebuah model tidak memiliki aset logo brand sendiri
- **THEN** sistem menampilkan ikon generik tier-nya, bukan gambar rusak

### Requirement: Pemilihan model spesifik

User SHALL dapat memilih satu model spesifik dari Model Store; pilihan itu mengunci jawaban chat ke model tersebut. Sistem SHALL menyediakan cara melepas pilihan model spesifik dan kembali ke mode otomatis per tier.

#### Scenario: Pilih model spesifik

- **WHEN** user memilih satu model di Model Store lalu mengirim pesan
- **THEN** jawaban chat diupayakan memakai model terpilih, dan composer menampilkan indikator bahwa mode manual aktif

#### Scenario: Lepas pilihan model

- **WHEN** user melepas pilihan model spesifik
- **THEN** composer kembali ke mode otomatis tier (Kilat/Seimbang/Mendalam) seperti sebelumnya

#### Scenario: Model terpilih sedang gagal

- **WHEN** model spesifik yang terpilih gagal melayani permintaan (error/timeout)
- **THEN** sistem melanjutkan ke model berikutnya dalam TIER MILIK MODEL TERPILIH itu (bukan tier mode kecepatan aktif) dan jawaban tetap terkirim — bukan error total

### Requirement: Mode otomatis per tier tetap default

Tanpa pilihan model spesifik, sistem SHALL memakai perilaku mode kecepatan seperti sekarang: tier Kilat/Seimbang/Mendalam dengan daftar model prioritas dan fallback berantai.

#### Scenario: User tidak memilih model

- **WHEN** user mengirim chat tanpa memilih model spesifik
- **THEN** permintaan memakai rantai tier dari mode kecepatan aktif

### Requirement: Validasi model di sisi server

Server SHALL hanya menerima id model yang termasuk katalog allowlist; id model asing SHALL diabaikan dan permintaan diproses dengan mode tier normal (tanpa error).

#### Scenario: Model asing dikirim klien

- **WHEN** permintaan chat memuat id model yang tidak ada di katalog
- **THEN** server memakainya sebagai mode otomatis tier normal, tanpa menolak permintaan

### Requirement: Model premium-only dikhususkan untuk pengguna Pro

Model bertanda premium-only (mis. GPT-6 Astra) SHALL hanya dapat digunakan pengguna Pro: di Model Store kartu-nya terkunci dengan penanda Pro bagi pengguna free (klik → menuju halaman upgrade), dan server SHALL menolak permintaan model itu dari pengguna non-Pro dengan pesan upgrade yang jelas. Model premium-only SHALL NOT ikut rotasi otomatis tier untuk pengguna free.

#### Scenario: Free user memilih model Pro

- **WHEN** pengguna free memilih model premium-only di Model Store
- **THEN** kartu tampil terkunci dengan badge Pro dan klik mengarahkan ke halaman upgrade; bila permintaan tetap dikirim ke server, server menolak dengan pesan "khusus pengguna Pro" + tautan upgrade

#### Scenario: Pro user memilih model Pro

- **WHEN** pengguna Pro memilih model premium-only
- **THEN** chat dijawab memakai model tersebut (dengan fallback tier-nya saat gagal)

#### Scenario: Mode otomatis tidak memakai model Pro

- **WHEN** pengguna free memakai mode tier (Kilat/Seimbang/Mendalam) tanpa memilih model
- **THEN** rantai otomatis tidak pernah menyertakan model premium-only

### Requirement: Pilihan model spesifik hanya untuk chat

Pemilihan model spesifik SHALL berlaku untuk chat asisten; pembuatan catatan, kuis, flashcards, dan judul SHALL tetap memakai mode tier otomatis.

#### Scenario: Catatan dibuat saat model manual aktif

- **WHEN** user memilih model spesifik lalu membuat catatan
- **THEN** pipeline catatan tetap memakai tier otomatis, bukan model terpilih
