# Spec Delta: ai-provider-routing

## Purpose

Mengatur aturan pemilihan provider AI per jenis beban kerja — semua generate teks (chat, catatan, kuis, judul, enrichment) dan embedding/transkripsi lewat Juan Router dengan fallback darurat OpenRouter, sedangkan OpenAgentic dikhususkan untuk generate gambar text-to-image dengan fallback Cloudflare.

## ADDED Requirements

### Requirement: Semua generate teks memakai Juan Router sebagai provider utama

Setiap permintaan generate teks — chat asisten, pembuatan catatan dari YouTube/web/dokumen, kuis, flashcards, judul sesi, prompt ilustrasi, dan enrichment web-search — SHALL dikirim ke Juan Router sebagai provider utama. Pemilihan model mengikuti tier kecepatan yang diminta user (Kilat/Seimbang/Mendalam), termasuk penyaringan model thinking saat reasoning dimatikan.

#### Scenario: Chat asisten memakai Juan Router

- **WHEN** user mengirim pesan chat dengan mode kecepatan apa pun
- **THEN** permintaan dikirim ke Juan Router dengan model dari tier kecepatan tersebut, dan TIDAK dikirim ke OpenAgentic

#### Scenario: Pembuatan catatan memakai Juan Router

- **WHEN** user memicu pemrosesan catatan (YouTube, artikel web, atau dokumen)
- **THEN** seluruh langkah generate teks dalam pipeline catatan (ekstraksi terstruktur, ringkasan, kuis, flashcards) dikirim ke Juan Router, bukan OpenAgentic

#### Scenario: Mode reasoning nonaktif

- **WHEN** user mematikan toggle reasoning
- **THEN** model thinking dikecualikan dari daftar model yang dicoba, dan permintaan tetap dikirim ke Juan Router

### Requirement: Fallback darurat teks hanya ke OpenRouter

Bila seluruh percobaan di Juan Router gagal (semua model tier error, 429, 503, atau timeout), sistem SHALL meneruskan permintaan teks ke OpenRouter sebagai fallback darurat. OpenAgentic SHALL NOT pernah dipakai untuk generate teks, baik sebagai jalur utama maupun fallback. Mekanisme override yang memaksa model lewat OpenAgentic untuk teks SHALL dinonaktifkan.

#### Scenario: Juan Router sibuk

- **WHEN** semua model Juan Router pada tier yang diminta mengembalikan error 429/503/timeout
- **THEN** permintaan diulang ke OpenRouter dan hasilnya dikembalikan ke pemanggil

#### Scenario: Juan dan OpenRouter sama-sama gagal

- **WHEN** Juan Router dan OpenRouter keduanya gagal
- **THEN** sistem mengembalikan error yang jelas ke pemanggil, dan TIDAK mencoba OpenAgentic untuk teks

#### Scenario: Override model dipaksa nonaktif untuk teks

- **WHEN** env override model-terpaksa diisi
- **THEN** override tersebut TIDAK mengarahkan generate teks ke OpenAgentic

### Requirement: OpenAgentic dikhususkan untuk text-to-image

OpenAgentic SHALL hanya dipakai untuk generate gambar (text-to-image), dan TIDAK dipakai untuk jenis beban lain. Bila generate gambar gagal di OpenAgentic, fallback gambar ke Cloudflare tetap berlaku.

#### Scenario: Generate gambar memakai OpenAgentic

- **WHEN** user meminta generate gambar di chat atau catatan
- **THEN** gambar dibuat melalui OpenAgentic dengan model image yang dikonfigurasi, lalu fallback ke Cloudflare bila gagal

#### Scenario: Kunci OpenAgentic kosong tapi fitur teks aktif

- **WHEN** `OPENAGENTIC_API_KEY` tidak diisi namun kunci Juan Router tersedia
- **THEN** semua fitur teks tetap berfungsi normal, dan generate gambar ditolak dengan pesan bahwa konfigurasi gambar belum aktif

### Requirement: Embedding dan transkripsi lewat Juan Router

Pembuatan embedding untuk RAG dan transkripsi audio SHALL memakai Juan Router selama kuncinya tersedia, mengikuti aturan yang sama dengan generate teks (fallback darurat ke OpenRouter bila endpoint terkait tersedia di sana; bila tidak tersedia di OpenRouter, error dilaporkan jelas).

#### Scenario: Embedding catatan baru

- **WHEN** catatan diproses dan chunk teks perlu di-embed
- **THEN** permintaan embedding dikirim ke Juan Router, bukan OpenAgentic

#### Scenario: Transkripsi audio

- **WHEN** konten audio perlu ditranskripsi via endpoint AI
- **THEN** permintaan dikirim ke Juan Router bila endpoint transkripsi didukung, selainnya error dilaporkan jelas tanpa fallback diam-diam ke OpenAgentic

### Requirement: Penolakan jelas saat kunci Juan Router tidak ada

Bila `JUANROUTER_API_KEY` tidak diisi, fitur AI teks SHALL menolak dengan pesan error yang jelas (bukan diam-diam berpindah ke OpenAgentic). Pengecualian: fallback ke OpenRouter masih berlaku bila hanya sebagian percobaan Juan yang gagal — bukan saat kunci Juan kosong sejak awal.

#### Scenario: Kunci Juan kosong

- **WHEN** `JUANROUTER_API_KEY` kosong dan user memicu fitur AI teks apa pun
- **THEN** sistem mengembalikan error "konfigurasi AI teks belum lengkap" tanpa memanggil OpenAgentic

#### Scenario: Kunci Juan kosong tapi kunci gambar ada

- **WHEN** `JUANROUTER_API_KEY` kosong dan `OPENAGENTIC_API_KEY` terisi
- **THEN** generate gambar tetap berfungsi, fitur teks menolak dengan pesan jelas

### Requirement: Observabilitas rute provider

Setiap panggilan AI SHALL mencatat provider dan model yang akhirnya melayani permintaan, sehingga rute Juan→OpenRouter (teks) dan OpenAgentic (gambar) bisa diverifikasi dari log.

#### Scenario: Verifikasi rute dari log

- **WHEN** satu permintaan teks dan satu permintaan gambar dieksekusi
- **THEN** log menunjukkan permintaan teks dilayani JuanRouter (atau OpenRouter saat darurat) dan permintaan gambar dilayani OpenAgentic/Cloudflare
