## ADDED Requirements

### Requirement: YouTube transcript multi-bahasa dengan fallback Whisper

Sistem SHALL mencoba mengambil transcript YouTube secara berurutan dengan bahasa `id` → `en` → `en-US` → default (tanpa lang), SHALL membersihkan marker suara `[Musik]`/`[Applause]` sebelum dipakai, dan jika transcript tetap kosong dan kredensial AI tersedia SHALL mengunduh audio via ytdl dan mentranskripsi via Whisper (`whisper-1` melalui provider OpenAI-compatible); jika Whisper tidak tersedia atau download gagal SHALL melempar error spesifik yang membedakan "tidak ada subtitle/CC" vs "auto-caption HP tidak terbaca via API".

#### Scenario: Transcript bahasa Indonesia tersedia
- **WHEN** pengguna membuat catatan dari link YouTube yang memiliki subtitle bahasa Indonesia
- **THEN** sistem mengambil transcript `id` dan menggunakannya sebagai teks sumber tanpa fallback Whisper

#### Scenario: Transcript fallback ke bahasa Inggris
- **WHEN** video tidak memiliki subtitle `id` tetapi memiliki `en` atau `en-US`
- **THEN** sistem mengambil transcript `en`/`en-US` dan tetap membuat catatan tanpa error

#### Scenario: Tidak ada subtitle, fallback Whisper berhasil
- **WHEN** video tidak memiliki subtitle apa pun tetapi kredensial Whisper tersedia dan audio dapat diunduh
- **THEN** sistem mengunduh audio, mentranskripsi via Whisper, dan menggunakan hasil transkrip sebagai teks sumber catatan

#### Scenario: Tidak ada subtitle dan Whisper tidak tersedia atau download Shorts gagal
- **WHEN** video Shorts/musik tanpa subtitle dan download audio gagal (`Failed to find any playable formats` / `Could not extract functions`)
- **THEN** sistem melempar error "Video ini tidak memiliki subtitle yang bisa diambil. Coba video lain, atau pakai sumber Dokumen/Web. Di HP kadang auto-caption muncul tapi di PC/scraper tidak terbaca" dengan detail `videoId`

### Requirement: Rate limit buat catatan 10 per jam dengan Retry-After

Sistem SHALL membatasi pembuatan catatan per user menjadi maksimal 10 per jam (naik dari 3), SHALL mengembalikan `429` dengan header `Retry-After` dan pesan "Kamu sudah membuat 10 catatan dalam 1 jam..." ketika batas terlampaui, dan SHALL mereset counter saat backend restart (in-memory) atau setelah window 1 jam.

#### Scenario: Dalam batas 10 per jam
- **WHEN** pengguna membuat catatan ke-5 dalam 1 jam
- **THEN** request diterima dengan `202 { jobId }` tanpa 429

#### Scenario: Melebihi batas
- **WHEN** pengguna mencoba membuat catatan ke-11 dalam 1 jam
- **THEN** sistem mengembalikan `429` dengan `Retry-After` dan pesan yang jelas, tanpa membuat job baru

### Requirement: Error per sumber harus spesifik dan terlihat di UI

Sistem SHALL menampilkan error per sumber yang gagal (label + pesan) ketika semua sumber gagal, SHALL menyimpan `error` detail (hingga 1200 karakter) di `updateJob` dan `tracker.emit`, dan SHALL menampilkan `Kode error: 429/401/503` di popup `CreateNoteModal` bersama `Detail: ...` dari provider.

#### Scenario: Semua sumber YouTube gagal tanpa subtitle
- **WHEN** pengguna membuat catatan dari 1 link YouTube tanpa subtitle dan Whisper fallback gagal
- **THEN** job berstatus `error` dengan `error: "Semua sumber gagal diproses. <label>: Video ini tidak memiliki subtitle..."` dan UI menampilkan popup dengan kode dan detail

#### Scenario: Satu sumber gagal tetapi lainnya valid
- **WHEN** pengguna membuat catatan dari 2 sumber (1 YouTube gagal, 1 dokumen valid)
- **THEN** sistem tetap memproses sumber valid, menyimpan `warnings: ["<label>: <error>"]`, dan menyelesaikan catatan dengan peringatan

## MODIFIED Requirements

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

#### Scenario: Rate limit tercapai
- **WHEN** pengguna telah mencapai 10 pembuatan dalam 1 jam
- **THEN** sistem menampilkan error 429 dengan pesan tunggu dan `Retry-After`, bukan error generik "Terjadi kesalahan..."

#### Scenario: Backend mati atau NEXT_PUBLIC_API_URL salah
- **WHEN** frontend mencoba `POST /api/notes/process` ke `http://localhost:3001` tetapi backend tidak jalan
- **THEN** sistem menampilkan error koneksi `ERR_CONNECTION_REFUSED` di console/Network dan menyarankan menjalankan `cd backend && npm run dev` atau set `NEXT_PUBLIC_API_URL=http://localhost:3000` untuk same-origin
