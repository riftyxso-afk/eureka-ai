## MODIFIED Requirements

### Requirement: AI berdiskusi tentang video secara realtime

Sistem SHALL mengekstrak transkrip video aktif dan menyuntikkannya sebagai konteks jawaban AI, SHALL mengalirkan jawaban AI secara realtime (streaming token demi token) seperti percakapan chat biasa, dan SHALL ketika video di-embed di bubble diputar menampilkan subtitle realtime beranimasi di bawah player yang sinkron dengan playback (highlight kata/kalimat aktif, auto-scroll, animasi typewriter/highlight-slide) menggunakan `segments`.

#### Scenario: Pertanyaan tentang isi video dijawab dari transkrip
- **WHEN** pengguna bertanya tentang isi video aktif yang memiliki transkrip/subtitle
- **THEN** jawaban AI mengalir realtime dan disusun berdasarkan isi transkrip video tersebut

#### Scenario: Video tanpa transkrip
- **WHEN** pengguna bertanya tentang video aktif yang transkripnya tidak tersedia
- **THEN** AI memberi tahu bahwa transkrip video tidak tersedia dan tetap menjawab sejujurnya dari konteks lain (mis. judul video atau pengetahuan umum) tanpa mengarang kutipan dari video

#### Scenario: Transkrip melebihi batas konteks
- **WHEN** transkrip video sangat panjang melebihi batas konteks yang diizinkan
- **THEN** transkrip dipotong ke bagian terbatas dan AI tetap menjawab dari bagian yang tersedia tanpa error

#### Scenario: Subtitle realtime saat video di bubble diputar
- **WHEN** pengguna menekan play pada embed YouTube di bubble yang memiliki `segments`
- **THEN** panel subtitle di bawah player menampilkan baris aktif yang disorot, auto-scroll, dan beranimasi sinkron dengan `offsetMs`/`durationMs`
