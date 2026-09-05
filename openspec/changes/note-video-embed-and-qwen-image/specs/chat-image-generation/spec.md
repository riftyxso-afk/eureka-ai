## Purpose

Generate gambar AI dari halaman chat (`/chat/[id]`) memakai model image OpenAgentic (`ali-qwen-image-2.0-pro`), dengan URL hasil yang bersifat sementara di-materialisasi server-side menjadi data yang tahan lama sebelum diterima klien.

## ADDED Requirements

### Requirement: Provider gambar utama adalah OpenAgentic

Sistem SHALL menghasilkan gambar dari permintaan "buat gambar" di halaman chat melalui model image OpenAgentic (default `ali-qwen-image-2.0-pro`, dapat di-override via env) memakai `OPENAGENTIC_API_KEY` yang sudah ada.

#### Scenario: Generate gambar berhasil

- **WHEN** pengguna meminta "buat gambar tentang X" di composer chat dan model OpenAgentic mengembalikan gambar
- **THEN** overlay menampilkan gambar hasil generate tersebut

#### Scenario: Model dapat diganti via env

- **WHEN** operator mengubah env model image
- **THEN** generate berikutnya memakai model yang baru tanpa mengubah kode

### Requirement: URL sementara wajib di-materialisasi server

Karena URL hasil model image OpenAgentic bersifat sementara (kedaluwarsa dalam hitungan hari), sistem SHALL men-download gambar di server dan mengirimkannya ke klien sebagai data yang tahan lama (data URL), BUKAN meneruskan URL sementara mentah ke klien.

#### Scenario: Klien menerima data tahan lama

- **WHEN** generate gambar berhasil
- **THEN** respons ke klien memuat gambar sebagai data URL (bukan URL sementara yang akan mati)

#### Scenario: Download hasil gagal

- **WHEN** URL yang dikembalikan model tidak dapat di-download server
- **THEN** sistem memperlakukan generate sebagai gagal dan menampilkan pesan error yang jelas

### Requirement: Fallback provider dan gating tetap

Bila OpenAgentic gagal/tidak tersedia, sistem SHALL mencoba provider gambar yang sudah ada (Cloudflare FLUX) sebagai fallback; gerbang premium dan rate limit yang berlaku saat ini TIDAK berubah.

#### Scenario: OpenAgentic down, fallback bekerja

- **WHEN** panggilan image OpenAgentic gagal (error/timeout)
- **THEN** sistem mencoba Cloudflare FLUX dan pengguna tetap bisa mendapat gambar bila fallback berhasil

#### Scenario: Non-premium tetap ditolak

- **WHEN** pengguna tanpa premium meminta generate gambar
- **THEN** permintaan ditolak dengan pesan upgrade seperti perilaku saat ini
