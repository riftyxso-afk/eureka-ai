## Purpose

Menampilkan preview embed yang collapse/expand untuk setiap link YouTube atau web yang dikirim di chat bubble, plus ringkasan dan subtitle realtime saat video diputar.

## ADDED Requirements

### Requirement: Deteksi link di bubble text dan render trigger embed

Sistem SHALL mendeteksi URL YouTube (`youtu.be/`, `youtube.com/watch`, `/shorts`, `/embed`) dan URL web umum (`https://`) di dalam `content` pesan user maupun assistant di bubble, dan SHALL merender trigger embed di bawah teks bubble tanpa mengubah teks asli.

#### Scenario: Pesan berisi link YouTube
- **WHEN** pengguna mengirim bubble berisi `https://youtu.be/Tmmok63hVj0`
- **THEN** di bawah teks bubble muncul trigger embed YouTube (thumbnail placeholder) untuk URL tersebut

#### Scenario: Pesan berisi link web umum
- **WHEN** pesan berisi `https://contoh.com/artikel`
- **THEN** di bawah teks bubble muncul trigger embed web untuk URL tersebut

#### Scenario: Pesan berisi banyak link
- **WHEN** bubble berisi dua link berbeda
- **THEN** sistem merender dua trigger embed terpisah sesuai urutan link

#### Scenario: Pesan tanpa link
- **WHEN** bubble tidak mengandung URL
- **THEN** tidak ada embed yang dirender

### Requirement: Preview embed YouTube collapse/expand

Sistem SHALL merender preview YouTube sebagai card collapse default (tinggi terbatas) yang dapat di-expand/collapse dengan animasi, menampilkan thumbnail (youtube-nocookie click-to-play), judul, channel/durasi, dan tombol `Ringkas`.

#### Scenario: Default collapsed
- **WHEN** embed YouTube pertama kali dirender di bubble
- **THEN** card tampil collapsed (thumbnail kecil, judul 1 baris) dan tidak memutar video

#### Scenario: Expand preview
- **WHEN** pengguna menekan toggle expand pada card YouTube
- **THEN** card mengembang dengan animasi `framer-motion` height, menampilkan thumbnail besar dan tombol `Ringkas`

#### Scenario: Collapse kembali
- **WHEN** pengguna menekan toggle lagi saat expanded
- **THEN** card kembali collapsed dengan animasi

### Requirement: Preview embed web umum collapse/expand

Sistem SHALL untuk link web umum memanggil `GET /api/link-preview?url=` (cache OG metadata: title, favicon, og:image, description via `scrapeWebUrl`/Firecrawl), dan SHALL merender card kecil collapse/expand serupa (favicon + title + domain + image) dengan tombol `Ringkas`.

#### Scenario: Preview web berhasil
- **WHEN** embed web untuk `https://contoh.com` berhasil fetch metadata
- **THEN** card menampilkan favicon, judul, domain, dan gambar og:image jika ada

#### Scenario: Preview web gagal
- **WHEN** fetch metadata gagal atau timeout
- **THEN** card tetap tampil minimal (domain + link) tanpa error blocking, dengan opsi retry

### Requirement: Tombol Ringkas di preview

Sistem SHALL menyediakan tombol `Ringkas` di setiap preview (YouTube & web) yang ketika ditekan memanggil ringkas link tersebut (reuse `processNoteForBackground`/`generateAiSummary`) dan menampilkan hasil ringkasan inline di bawah preview dalam keadaan expandable, tanpa pindah halaman.

#### Scenario: Ringkas YouTube
- **WHEN** pengguna menekan `Ringkas` pada preview YouTube
- **THEN** sistem menampilkan loading lalu ringkasan isi video di bawah preview

#### Scenario: Ringkas web
- **WHEN** pengguna menekan `Ringkas` pada preview web
- **THEN** sistem menampilkan ringkasan halaman web di bawah preview

### Requirement: Subtitle realtime beranimasi saat video diputar

Sistem SHALL ketika pengguna menekan play pada embed YouTube, menampilkan panel subtitle realtime di bawah/beside player yang berjalan sinkron dengan playback, menyorot kata/kalimat aktif, auto-scroll ke baris aktif, dan menganimasikan highlight (`typewriter`/`highlight-slide`) menggunakan `segments` (`offsetMs`/`durationMs`) dari `scrapeYoutubeTranscript` atau fallback Whisper.

#### Scenario: Subtitle berjalan sinkron
- **WHEN** video diputar dan `segments` tersedia
- **THEN** baris subtitle aktif disorot dan di-scroll otomatis sesuai `offsetMs` video

#### Scenario: Animasi highlight kata
- **WHEN** kalimat subtitle aktif berubah
- **THEN** kata/kalimat baru muncul dengan animasi `typewriter` atau `highlight-slide` yang halus

#### Scenario: Video tanpa subtitle
- **WHEN** video tidak memiliki `segments` dan fallback Whisper juga gagal
- **THEN** panel subtitle menampilkan pesan "Subtitle tidak tersedia" tanpa error, video tetap dapat diputar
