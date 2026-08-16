## Purpose

Mengganti emoji pada antarmuka dan pada data pengguna (ikon subjek, misi, onboarding, rekomendasi) dengan ikon lucide yang konsisten, tanpa migrasi data dan tanpa mengubah konten yang dihasilkan AI.

## ADDED Requirements

### Requirement: Emoji dekoratif UI diganti ikon lucide

Sistem SHALL menampilkan ikon lucide sebagai pengganti emoji pada elemen antarmuka yang dikendalikan kode — tombol, badge status, heading, sapaan, toast/notifikasi, dan indikator — pada halaman area login dan halaman publik.

#### Scenario: Elemen UI tanpa emoji

- **WHEN** pengguna membuka halaman yang sebelumnya menampilkan emoji dekoratif (mis. sapaan "Halo 👋", badge "🔥", tombol "🚀")
- **THEN** elemen tersebut menampilkan ikon lucide yang bermakna sesuai konteks

#### Scenario: Toast dan notifikasi memakai ikon

- **WHEN** sistem menampilkan pesan sukses/error/galat validasi
- **THEN** pesan tersebut menggunakan ikon lucide alih-alih emoji (✅/⚠️/🙏 dan sejenisnya)

### Requirement: Emoji data dipetakan ke ikon saat render

Sistem SHALL menampilkan ikon lucide untuk nilai data yang berisi emoji — ikon mata pelajaran, ikon misi, ikon langkah onboarding, dan ikon rekomendasi — dengan memetakan emoji ke ikon pada saat render, tanpa mengubah nilai yang tersimpan di database.

#### Scenario: Subjek dengan emoji dirender sebagai ikon

- **WHEN** aplikasi menampilkan daftar/ikon mata pelajaran yang tersimpan dengan emoji (mis. 🧮 untuk Matematika)
- **THEN** emoji tersebut dirender sebagai ikon lucide yang sesuai, dan nilai emoji di database tetap tidak berubah

#### Scenario: Emoji data yang tidak dikenal

- **WHEN** aplikasi menemukan nilai emoji data yang tidak ada dalam pemetaan
- **THEN** aplikasi menampilkan ikon cadangan (default) yang konsisten, bukan emoji mentah

### Requirement: Konten hasil AI tidak diubah

Sistem SHALL membiarkan emoji yang ada di dalam konten yang dihasilkan AI — jawaban chat, isi catatan, kuis, dan kartu hafalan — tampil apa adanya tanpa penggantian.

#### Scenario: Emoji di jawaban AI tetap tampil

- **WHEN** pengguna membaca jawaban asisten atau isi catatan yang mengandung emoji dari model
- **THEN** emoji tersebut tetap ditampilkan sebagaimana dihasilkan model
