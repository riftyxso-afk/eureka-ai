# Spec Delta: chat-visual-hierarchy

## ADDED Requirements

### Requirement: Satu aksen primer untuk aksi utama

Halaman chat SHALL memakai satu warna aksen primer (`--accent-coral`) untuk seluruh tombol/CTA aksi utama: tombol kirim, toggle Eureka Multi Agent saat aktif, highlight chat terpilih di sidebar, dan tombol aksi primer header ("Bagikan"). Warna lain (ungu `--clay-primary`, mint, violet) SHALL NOT dipakai sebagai warna tombol aksi yang tampil bersamaan dengan coral pada satu layar; ungu boleh dipakai untuk elemen brand/dekoratif (logo, avatar, ikon).

#### Scenario: Layar chat penuh

- **WHEN** siswa membuka halaman chat dengan canvas terbuka dan sidebar terlihat
- **THEN** semua tombol aksi primer yang tampil memakai warna coral yang sama, dan tidak ada tombol aksi berwarna ungu/gold yang bersaing dengannya

#### Scenario: Chat terpilih di sidebar

- **WHEN** siswa memilih salah satu chat di sidebar
- **THEN** item aktif di-highlight dengan latar coral tipis (bukan ungu)

### Requirement: Metadata teknis tidak tampil di tampilan default

Nama model AI (mis. "VIA GLM 5.3 FLASH"), codename agent internal (mis. "jejak"), dan durasi respons ("AI menjawab dalam…") SHALL NOT tampil sebagai teks/tag permanen di UI utama. Informasi ini SHALL tetap dapat diakses melalui lapisan sekunder (tooltip saat hover/tap ikon info kecil) tanpa menghilangkan datanya.

#### Scenario: Bubble jawaban AI selesai

- **WHEN** siswa melihat bubble jawaban AI yang sudah selesai
- **THEN** tidak ada tag model maupun teks durasi yang tampil permanen; keduanya muncul saat hover/tap pada ikon info kecil di area meta bubble

#### Scenario: Footer Artifact Canvas

- **WHEN** siswa melihat artifact di canvas
- **THEN** footer menampilkan teks ramah (mis. "Tersimpan otomatis · v1") dan tidak menampilkan nama codename agent

### Requirement: Header chat satu aksi primer dengan overflow

Header chat SHALL menampilkan maksimal satu tombol solid aksi primer ("Bagikan"); aksi lain (toggle Canvas, Salin chat, Chat baru) SHALL dirender sebagai ikon minimal tanpa latar berwarna, dan aksi yang jarang dipakai SHALL dikelompokkan ke menu overflow (ikon "⋯") bila jumlah aksi melebihi tiga.

#### Scenario: Header pada layar sempit

- **WHEN** halaman chat dibuka pada viewport sempit
- **THEN** hanya tombol Bagikan yang tampil sebagai tombol solid, dan aksi sekunder berupa ikon atau masuk menu overflow

#### Scenario: Toggle canvas

- **WHEN** ada artifact di sesi dan siswa menekan ikon Canvas di header
- **THEN** panel canvas terbuka/tertutup seperti sebelumnya (fungsionalitas tidak berubah)

### Requirement: Sitasi sumber sebagai elemen ringan

Sitasi/sumber dokumen di dalam Artifact Canvas SHALL dirender sebagai satu baris teks kecil berwarna netral dengan ikon dokumen, TANPA border tebal atau latar blok penuh warna.

#### Scenario: Artifact dengan sumber dokumen

- **WHEN** artifact markdown memuat baris sitasi (mis. "*(Sumber: Soal_Fisika_SMA.pdf)*")
- **THEN** sitasi tampil sebagai satu baris teks halus di atas konten, bukan banner berborder tebal

### Requirement: Aksi per-pesan muncul on-hover

Tombol salin per-pesan SHALL muncul saat hover pada bubble (atau tap pada perangkat sentuh), bukan sebagai tombol permanen yang selalu terlihat. Seluruh fungsionalitas salin SHALL tetap berfungsi seperti sebelumnya.

#### Scenario: Hover bubble jawaban

- **WHEN** kursor berada di atas bubble jawaban AI
- **THEN** tombol salin kecil muncul dan berfungsi menyalin isi pesan

### Requirement: Tidak ada fungsionalitas yang dihapus

Redesign visual SHALL NOT menghapus atau mengurangi akses ke fitur apa pun yang ada sebelumnya: salin chat, salin pesan, toggle canvas, bagikan, chat baru, ubah judul, hapus sesi, selector model, dan seluruh aksi canvas (copy/edit/simpan) tetap dapat diakses.

#### Scenario: Audit fitur pasca-redesign

- **WHEN** implementasi selesai dan diuji
- **THEN** seluruh aksi yang tersedia sebelum redesign masih dapat dijalankan dari UI (lokasi boleh berubah, mis. pindah ke menu overflow atau tooltip)
