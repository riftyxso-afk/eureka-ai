## Purpose

Lets users watch a YouTube video inline on the chat and note pages while discussing its content with the AI in real time, using the video transcript as answer context.

## ADDED Requirements

### Requirement: Embed video YouTube di pesan chat

Sistem SHALL mendeteksi link YouTube (youtube.com/watch, youtu.be, youtube.com/shorts, youtube.com/embed) pada pesan yang dikirim pengguna di halaman `/chat/[id]`, merender video sebagai player inline di bawah pesan user tersebut, dan SHALL tetap memproses pesan seperti biasa tanpa memuat ulang halaman.

#### Scenario: Pesan memuat link YouTube

- **WHEN** pengguna mengirim pesan yang berisi link YouTube yang valid
- **THEN** video tampil sebagai player inline di bawah pesan user tersebut dan AI tetap menjawab pesan tersebut

#### Scenario: Link tidak valid atau bukan YouTube

- **WHEN** pengguna mengirim pesan yang berisi URL yang bukan link YouTube valid
- **THEN** tidak ada player yang dirender dan pesan diproses sebagai pesan biasa tanpa error

#### Scenario: Player dimuat saat diklik (click-to-play)

- **WHEN** embed video pertama kali muncul di chat
- **THEN** yang tampil hanya thumbnail video; iframe player baru dimuat setelah pengguna mengekliknya

### Requirement: Video aktif sesi

Sistem SHALL memperlakukan link YouTube terbaru yang dikirim pengguna pada sebuah sesi chat sebagai "video aktif" sesi tersebut, dan SHALL tetap menyediakan konteks video itu untuk pertanyaan-pertanyaan berikutnya dalam sesi yang sama, termasuk setelah halaman dimuat ulang.

#### Scenario: Pertanyaan lanjutan tentang video

- **WHEN** pengguna mengirim link YouTube lalu bertanya lebih lanjut tentang video tersebut pada pesan-pesan berikutnya di sesi yang sama
- **THEN** jawaban AI tetap menggunakan konteks video aktif tersebut

#### Scenario: Konteks video bertahan setelah reload

- **WHEN** pengguna memuat ulang halaman chat sesi yang sudah memiliki video aktif
- **THEN** video aktif masih terdeteksi dari riwayat pesan dan pertanyaan baru tetap mendapat konteks video

#### Scenario: Video baru menggantikan video aktif

- **WHEN** pengguna mengirim link YouTube lain di sesi yang sama
- **THEN** video terbaru menjadi video aktif dan dipakai sebagai konteks jawaban berikutnya

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

### Requirement: Embed video di halaman catatan

Sistem SHALL menampilkan player video YouTube di halaman `/dashboard/note/[id]` ketika catatan tersebut dibuat dari sumber YouTube (subjek "YouTube" dengan URL sumber terisi), sehingga pengguna bisa menonton video sambil membaca catatan dan bertanya kepada AI tentang materinya.

#### Scenario: Catatan bersumber YouTube menampilkan player

- **WHEN** pengguna membuka halaman catatan yang bersumber dari video YouTube
- **THEN** player video tampil di halaman catatan (click-to-play) beserta akses tanya-jawab AI tentang materi catatan tersebut

#### Scenario: Catatan bukan dari YouTube tidak menampilkan player

- **WHEN** pengguna membuka halaman catatan yang sumbernya bukan YouTube
- **THEN** tidak ada player video yang tampil dan tidak ada perubahan pada tata letak halaman

### Requirement: Player hanya dari domain YouTube resmi

Sistem SHALL memuat iframe player hanya dari domain resmi YouTube yang diizinkan kebijakan CSP (`frame-src`) aplikasi, dan SHALL menggunakan mode privasi (youtube-nocookie.com) bila tersedia.

#### Scenario: iframe player mematuhi CSP

- **WHEN** embed video dirender
- **THEN** iframe memakai domain YouTube resmi yang sudah tercantum di kebijakan `frame-src`, dan tidak ada permintaan ke domain pihak ketiga lain
