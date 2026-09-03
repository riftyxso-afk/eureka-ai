## Purpose

Memungkinkan siswa menyeleksi teks di halaman web mana pun dan langsung memulai dialog Socratic dengan Eureka tanpa copy-paste manual ke web app.

## ADDED Requirements

### Requirement: Tanya Eureka dari teks terpilih

Sistem SHALL menyediakan item context menu "Tanya Eureka" yang muncul ketika pengguna menyeleksi teks di halaman web mana pun, dan SHALL membuka side panel dengan sesi Socratic yang konteksnya adalah teks terpilih tersebut.

#### Scenario: Highlight lalu tanya

- **WHEN** pengguna menyeleksi sebuah paragraf soal di sebuah artikel lalu memilih "Tanya Eureka" dari menu klik kanan
- **THEN** side panel terbuka dan Eureka merespons dengan pertanyaan pemandu yang merujuk pada teks terpilih, bukan jawaban langsung

#### Scenario: Tanpa seleksi teks

- **WHEN** pengguna membuka context menu tanpa menyeleksi teks apa pun
- **THEN** item "Tanya Eureka" tidak ditampilkan atau dalam keadaan nonaktif

### Requirement: Respons Socratic atas highlight

Eureka SHALL menanggapi teks terpilih dengan pertanyaan pemandu yang menuntun siswa berpikir (gaya Socratic), dan SHALL mencantumkan kutipan atau rujukan pada teks terpilih di awal sesi.

#### Scenario: Pertanyaan pemandu pertama

- **WHEN** sesi Highlight-to-Tanya dimulai dari sebuah teks soal
- **THEN** pesan pertama Eureka berupa pertanyaan pemandu yang berkaitan dengan teks tersebut, bukan solusi jadi

#### Scenario: Dialog berlanjut

- **WHEN** siswa menjawab pertanyaan pemandu
- **THEN** dialog Socratic berlanjut dalam sesi yang sama dengan konteks teks terpilih tetap terjaga

### Requirement: Berfungsi lintas jenis situs

Highlight-to-Tanya SHALL berfungsi minimal pada tiga jenis situs: artikel umum, LMS umum, dan PDF viewer bawaan browser.

#### Scenario: Artikel umum

- **WHEN** pengguna menyeleksi teks di sebuah artikel berita/blog lalu memilih "Tanya Eureka"
- **THEN** sesi Socratic dimulai dengan teks tersebut sebagai konteks

#### Scenario: PDF viewer browser

- **WHEN** pengguna menyeleksi teks di dokumen PDF yang dibuka di viewer bawaan browser lalu memilih "Tanya Eureka"
- **THEN** sesi Socratic dimulai dengan teks tersebut sebagai konteks
