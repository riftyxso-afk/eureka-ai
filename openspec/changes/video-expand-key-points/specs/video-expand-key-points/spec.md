## Purpose

Lets users expand a YouTube video embed into a wide view (video on the left) with a panel of key points about the video's content on the right, so they can grasp the essence of the video while watching it.

## ADDED Requirements

### Requirement: Tombol View dan tampilan expand pada embed video

Sistem SHALL menyediakan tombol "View" pada embed video YouTube di halaman `/chat/[id]` dan kartu "Video Sumber" di `/dashboard/note/[id]`, yang ketika diklik memperluas tampilan menjadi layout lebar dengan video di sisi kiri dan panel poin-poin isi video di sisi kanan (di viewport sempit, panel menumpuk di bawah video), dan SHALL dapat ditutup kembali ke tampilan semula.

#### Scenario: Membuka tampilan expand

- **WHEN** pengguna mengeklik tombol View pada sebuah embed video
- **THEN** tampilan expand terbuka dengan video tetap dapat diputar di sisi kiri dan panel poin-poin tampil di sisi kanan

#### Scenario: Menutup tampilan expand

- **WHEN** pengguna menutup tampilan expand (tombol tutup / area luar)
- **THEN** tampilan kembali seperti semula tanpa mengganggu posisi scroll atau percakapan/catatan

#### Scenario: Video yang sedang diputar tetap berjalan saat expand

- **WHEN** pengguna membuka tampilan expand pada video yang sudah mulai diputar
- **THEN** video tetap berjalan di tampilan expand tanpa perlu memuat ulang

### Requirement: Poin-poin isi video digenerate AI dari transkrip

Sistem SHALL mengekstrak transkrip video dan meminta AI meringkasnya menjadi 5–8 poin penting dalam bahasa Indonesia untuk panel kanan tampilan expand, SHALL menampilkan state loading selama proses berlangsung, dan SHALL menyimpan hasilnya sementara agar tidak digenerate ulang untuk video yang sama dalam waktu dekat.

#### Scenario: Generate poin di chat

- **WHEN** pengguna membuka tampilan expand pada video di chat
- **THEN** panel menampilkan loading lalu poin-poin hasil generate dari transkrip video

#### Scenario: Generate poin di halaman catatan

- **WHEN** pengguna membuka tampilan expand pada video di halaman catatan
- **THEN** panel menampilkan loading lalu poin-poin hasil generate dari transkrip video (perilaku sama seperti di chat)

#### Scenario: Generate berhasil lalu dibuka lagi

- **WHEN** pengguna menutup lalu membuka kembali tampilan expand untuk video yang sama dalam waktu dekat
- **THEN** poin yang sama ditampilkan langsung tanpa panggilan AI ulang

#### Scenario: Transkrip tidak tersedia

- **WHEN** video tidak memiliki transkrip yang bisa diekstrak
- **THEN** panel menampilkan pesan jelas bahwa poin tidak bisa dibuat, tanpa error yang membingungkan

#### Scenario: Permintaan berlebihan ditolak

- **WHEN** pengguna melakukan terlalu banyak permintaan generate dalam waktu singkat
- **THEN** sistem menolak dengan pesan jelas dan tidak mengganggu pemutaran video

### Requirement: Keamanan akses

Sistem SHALL memverifikasi identitas pengguna pada permintaan generate poin.

#### Scenario: Pengguna tidak terautentikasi

- **WHEN** permintaan generate poin datang tanpa sesi pengguna yang valid
- **THEN** permintaan ditolak dan panel menampilkan pesan untuk masuk/login
