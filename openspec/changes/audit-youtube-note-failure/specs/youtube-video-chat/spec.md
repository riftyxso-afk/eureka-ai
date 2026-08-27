## MODIFIED Requirements

### Requirement: AI berdiskusi tentang video secara realtime

Sistem SHALL mengekstrak transkrip video aktif dan menyuntikkannya sebagai konteks jawaban AI, dan SHALL mengalirkan jawaban AI secara realtime (streaming token demi token) seperti percakapan chat biasa.

#### Scenario: Pertanyaan tentang isi video dijawab dari transkrip
- **WHEN** pengguna bertanya tentang isi video aktif yang memiliki transkrip/subtitle
- **THEN** jawaban AI mengalir realtime dan disusun berdasarkan isi transkrip video tersebut

#### Scenario: Video tanpa transkrip
- **WHEN** pengguna bertanya tentang video aktif yang transkripnya tidak tersedia
- **THEN** AI memberi tahu bahwa transkrip video tidak tersedia dan tetap menjawab sejujurnya dari konteks lain (mis. judul video atau pengetahuan umum) tanpa mengarang kutipan dari video

#### Scenario: Transkrip melebihi batas konteks
- **WHEN** transkrip video sangat panjang melebihi batas konteks yang diizinkan
- **THEN** transkrip dipotong ke bagian terbatas dan AI tetap menjawab dari bagian yang tersedia tanpa error

#### Scenario: Auto-caption HP vs scraper PC berbeda
- **WHEN** video menampilkan subtitle di aplikasi HP tetapi `youtube-transcript` tidak mengembalikan hasil untuk `id`/`en`/`en-US`/default
- **THEN** sistem mencoba fallback Whisper (download audio via ytdl) sebelum menyatakan "tidak ada subtitle", dan jika Whisper juga gagal menampilkan pesan "Di HP kadang auto-caption muncul tapi di PC/scraper tidak terbaca — itu normal untuk Shorts/video tanpa CC manual" dengan saran pakai Dokumen/Web

#### Scenario: Fallback Whisper berhasil untuk video tanpa CC
- **WHEN** video tanpa subtitle tetapi audio berhasil diunduh dan Whisper tersedia
- **THEN** transkrip hasil Whisper dipakai sebagai konteks chat video, dan AI menjawab dari transkrip tersebut

## ADDED Requirements

### Requirement: Ekstraksi transcript YouTube harus coba multi-bahasa dan bersihkan marker suara

Sistem SHALL mencoba bahasa `id` → `en` → `en-US` → tanpa lang secara berurutan via `youtube-transcript`, SHALL membuang marker `[Musik]`/`[Applause]`/`[Tepuk tangan]` via regex, dan SHALL menggabungkan segmen menjadi teks tunggal sebelum dipakai untuk catatan atau chat.

#### Scenario: Video dengan subtitle Indonesia
- **WHEN** video memiliki track `id`
- **THEN** sistem mengambil track `id` pada percobaan pertama tanpa mencoba `en`

#### Scenario: Video dengan marker suara
- **WHEN** transcript mengandung `[Musik]` atau `[Tertawa]`
- **THEN** marker tersebut dihapus dan spasi dirapikan sebelum teks dipakai

### Requirement: Provider chat vs buat catatan harus terpisah

Sistem SHALL menggunakan rantai provider terpisah: `forChat=true` → Juan Router only (`SPEED_MODEL_LISTS` Kilat/Seimbang/Mendalam yang sudah difilter ON), `forChat=false` → OpenAgentic (`deepseek-v4-flash-free`, `hy3-free`) + OpenRouter (`:free` only) dengan urutan JSON-reliable (OpenAgentic dulu, baru OpenRouter), dan SHALL mendokumentasikan bahwa `9Router` nonaktif.

#### Scenario: Chat asisten
- **WHEN** pengguna mengirim pesan chat dengan `speedMode=fast` dan `forChat=true`
- **THEN** sistem mencoba `gemini-3.7-flash-low` (Juan) terlebih dahulu, bukan `deepseek-v4-flash-free` (OpenAgentic)

#### Scenario: Buat catatan
- **WHEN** sistem memanggil `aiChatJson` untuk `processSubtitleToChapters` tanpa `forChat`
- **THEN** sistem mencoba `deepseek-v4-flash-free` (OpenAgentic) terlebih dahulu, bukan Juan, sehingga JSON lebih reliable
