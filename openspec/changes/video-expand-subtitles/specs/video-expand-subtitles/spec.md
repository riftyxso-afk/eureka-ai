## Purpose

Menampilkan subtitle video yang berjalan sinkron dengan pemutaran di bawah embed video pada overlay View — teks mengikuti alur video secara realtime, dengan gaya claymorphism yang konsisten dengan aplikasi.

## ADDED Requirements

### Requirement: Panel subtitle sinkron di overlay View

Saat pengguna membuka overlay "View" pada embed video dan transkrip tersedia, sistem SHALL menampilkan panel subtitle bergaya claymorphism tepat di bawah embed video di kolom kiri overlay. Panel menampilkan baris-baris subtitle berurutan; baris yang sesuai dengan waktu pemutaran video saat ini ditandai menonjol dan otomatis di-scroll agar selalu terlihat. Highlight SHALL mengikuti pemutaran secara realtime, termasuk saat video dijeda, di-seek, atau buffering.

#### Scenario: Subtitle tampil di bawah video saat overlay dibuka

- **WHEN** pengguna membuka overlay View pada video yang memiliki subtitle
- **THEN** panel subtitle claymorphism tampil di bawah embed video dengan baris-baris teks berurutan dan baris pertama ditandai sebagai aktif

#### Scenario: Teks berjalan mengikuti pemutaran video

- **WHEN** video sedang diputar dan waktu pemutaran memasuki rentang segmen subtitle berikutnya
- **THEN** penanda aktif berpindah ke segmen tersebut dan panel otomatis scroll agar segmen aktif terlihat

#### Scenario: Jeda, seek, dan buffering tidak merusak sinkronisasi

- **WHEN** pengguna menjeda video, memindahkan posisi (seek), atau video buffering
- **THEN** penanda aktif tetap sesuai posisi pemutaran sebenarnya (bukan perkiraan waktu dinding)

#### Scenario: Klik baris subtitle melompatkan video

- **WHEN** pengguna mengklik baris subtitle tertentu
- **THEN** video berpindah ke waktu mulai segmen tersebut dan pemutaran berlanjut dari sana

#### Scenario: Overlay ditutup menghentikan semua pemantauan

- **WHEN** pengguna menutup overlay View
- **THEN** polling posisi video dan auto-scroll dihentikan sehingga tidak ada pekerjaan latar yang tersisa

### Requirement: Endpoint transkrip bertimestamp

Sistem SHALL menyediakan endpoint `POST /api/video/transcript` yang menerima `url` video YouTube dan `userId`, mewajibkan otorisasi sesi pengguna, dan mengembalikan daftar segmen subtitle `{ text, offsetMs, durationMs }` beserta judul video. Hasil per video SHALL di-cache di server sehingga membuka ulang overlay tidak memanggil layanan YouTube lagi dalam masa cache. Endpoint tidak memerlukan API key AI.

#### Scenario: Permintaan valid mengembalikan segmen

- **WHEN** pengguna terautentikasi mengirim `url` YouTube valid yang memiliki subtitle
- **THEN** endpoint mengembalikan 200 dengan `segments` berisi `text`, `offsetMs`, `durationMs` yang terurut dan `title` video

#### Scenario: Buka ulang memakai cache

- **WHEN** pengguna meminta transkrip video yang sama dalam masa cache
- **THEN** endpoint mengembalikan segmen yang sama tanpa memanggil layanan YouTube lagi

#### Scenario: Link tidak valid

- **WHEN** pengguna mengirim `url` yang bukan link YouTube yang dikenali
- **THEN** endpoint mengembalikan 400 dengan pesan kesalahan yang jelas

#### Scenario: Video tanpa subtitle

- **WHEN** video tidak memiliki subtitle yang bisa diambil
- **THEN** endpoint mengembalikan 422 dengan pesan bahwa subtitle tidak tersedia

#### Scenario: Belum login

- **WHEN** permintaan dikirim tanpa otorisasi sesi yang valid
- **THEN** endpoint menolak dengan 401 dan tidak mengembalikan data transkrip

### Requirement: Penanganan video tanpa subtitle di panel

Jika subtitle tidak tersedia, panel subtitle SHALL menampilkan pesan jujur yang menjelaskan bahwa video ini tidak memiliki subtitle — tanpa mengganggu pemutaran video atau panel poin di sebelah kanan, dan tanpa memicu percobaan ulang otomatis.

#### Scenario: Panel menampilkan pesan subtitle tidak tersedia

- **WHEN** overlay View dibuka pada video tanpa subtitle
- **THEN** panel subtitle menampilkan pesan bahwa subtitle tidak tersedia, video tetap bisa diputar, dan panel poin tetap berfungsi seperti biasa

#### Scenario: Tidak ada percobaan ulang otomatis

- **WHEN** subtitle tidak tersedia
- **THEN** sistem tidak memicu permintaan ulang transkrip secara otomatis

### Requirement: Keamanan dan sumber iframe

Sistem SHALL memuat skrip YouTube IFrame API hanya dari domain resmi `https://www.youtube.com` dan hanya jika kebijakan CSP mengizinkannya; iframe pemutar SHALL tetap hanya dari domain YouTube resmi (`www.youtube.com` / `www.youtube-nocookie.com`). Permintaan transkrip SHALL tetap melewati otorisasi sesi yang sama dengan endpoint poin video.

#### Scenario: Skrip IFrame API dimuat dari domain resmi

- **WHEN** overlay View aktif dan membutuhkan sinkronisasi pemutaran
- **THEN** skrip IFrame API dimuat dari `https://www.youtube.com/iframe_api` dan kebijakan CSP menyertakan sumber tersebut

#### Scenario: Iframe tetap dari domain YouTube

- **WHEN** embed video dirender
- **THEN** iframe hanya menunjuk ke `www.youtube-nocookie.com` atau `www.youtube.com`, tidak ke domain lain

#### Scenario: Transkrip butuh otorisasi

- **WHEN** endpoint transkrip dipanggil dari sesi tanpa login
- **THEN** data transkrip tidak dikembalikan (401)
