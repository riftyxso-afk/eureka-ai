# orb-loading-system Delta

## Purpose

Bahasa loading terpadu berbasis pustaka `thinking-orbs`: setiap konteks menunggu AI dipetakan ke satu state orb yang bermakna (thinking/searching/working/connecting), dengan ukuran dan tema yang konsisten di seluruh aplikasi.

## ADDED Requirements

### Requirement: Pemetaan konteks loading ke state orb

Sistem SHALL menggunakan komponen orb `thinking-orbs` untuk indikator menunggu AI pada permukaan asisten & catatan, dengan pemetaan wajib: berpikir/streaming jawaban → state `composing`; pencarian web → `searching`; memproses/membuat catatan → `working`; memuat sesi percakapan → `connecting`. Indikator titik generik pada konteks-konteks tersebut TIDAK BOLEH dipakai lagi.

#### Scenario: Asisten berpikir saat streaming

- **WHEN** asisten sedang menyiapkan atau men-streaming jawaban di bubble chat
- **THEN** indikator yang tampil adalah orb state `composing`, bukan titik-titik generik

#### Scenario: Pencarian web berjalan

- **WHEN** pipeline pencarian web aktif selama percakapan
- **THEN** indikator tahap pencarian menampilkan orb state `searching`

#### Scenario: Memproses pembuatan catatan

- **WHEN** pengguna memicu pembuatan catatan (modal atau overlay progres)
- **THEN** indikator proses menampilkan orb state `working`

### Requirement: Ukuran dan tema mengikuti preset resmi

Penggunaan orb SHALL hanya memakai dua ukuran preset pustaka — 64 untuk skala avatar/kartu dan 20 untuk inline teks — dengan tema `auto` sehingga warna orb mengikuti mode terang/gelap aplikasi secara otomatis.

#### Scenario: Orb inline dalam teks status

- **WHEN** orb ditampilkan berdampingan dengan teks status pendek
- **THEN** ukuran yang dipakai adalah preset 20, sejajar tinggi baris teks

#### Scenario: Tema mengikuti mode gelap

- **WHEN** pengguna beralih ke mode gelap lalu memicu sebuah loading
- **THEN** orb tampil dengan tinta terang untuk latar gelap tanpa konfigurasi tambahan

### Requirement: Reduced motion menonaktifkan animasi orb

Ketika `prefers-reduced-motion` aktif, orb SHALL tampil sebagai bentuk statis (tanpa animasi partikel) namun tetap terlihat sebagai penanda loading.

#### Scenario: Pengguna reduced motion membuka loading

- **WHEN** preferensi reduced motion aktif di sistem pengguna
- **THEN** orb tampil statis tanpa gerak partikel, dan tidak ada error render
