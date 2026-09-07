# Spec Delta: artifact-canvas

## ADDED Requirements

### Requirement: Struktur data Artifact

Sistem SHALL mendefinisikan struktur `Artifact` dengan field: `id` (string), `type` (`"markdown" | "terminal" | "image"`), `title` (string), `content` (string), `version` (number), `createdAt` (string), dan `sourceAgent` (`"jejak" | "socra" | "palet"`). Field `version` SHALL bertambah setiap artifact markdown diedit dan disimpan ulang.

#### Scenario: Artifact hasil edit

- **WHEN** user mengedit artifact markdown di canvas lalu menyimpannya
- **THEN** artifact tersimpan dengan `version` bertambah satu, bukan menggantikan versi lama tanpa jejak

### Requirement: Deteksi artifact dari stream

Output AI yang berisi output non-percakapan SHALL ditandai tag terstruktur `<artifact type="..." title="...">...</artifact>` dan diparse dari stream token-by-token, dipisahkan dari teks percakapan yang tetap masuk bubble chat. Parser SHALL toleran terhadap tag yang belum lengkap selama streaming: konten di-buffer dan TIDAK bocor sebagian ke bubble chat.

#### Scenario: Tag lengkap di stream

- **WHEN** model menghasilkan teks chat lalu tag artifact lengkap
- **THEN** teks chat dirender di bubble, isi tag dirender sebagai artifact di canvas, keduanya terpisah

#### Scenario: Tag belum lengkap saat streaming

- **WHEN** stream masih mengirim sebagian tag artifact (mis. baru `<artifact type="mark`)
- **THEN** sebagian tag tidak tampil di bubble maupun canvas sampai tag tertutup atau stream selesai

#### Scenario: Tag tidak pernah tertutup sampai stream selesai

- **WHEN** stream berakhir dengan tag artifact yang tidak tertutup
- **THEN** isi buffer di-flush sebagai teks biasa di bubble (atau dibuang dengan aman), tanpa crash, dan kejadian tercatat di log

### Requirement: Panel Artifact Canvas terpisah dari chat

Sistem SHALL menyediakan panel rendering terpisah dari bubble chat untuk artifact, dipakai lintas agent yang menghasilkan output non-percakapan: catatan (Jejak), hasil eksekusi/verifikasi (Solve-then-Guide), gambar (Palet).

#### Scenario: Jejak menghasilkan catatan

- **WHEN** agent Jejak menghasilkan ringkasan/catatan selama sesi
- **THEN** catatan muncul sebagai artifact `markdown` di canvas, bukan sebagai bubble chat panjang

### Requirement: Toolbar per tipe artifact

Canvas SHALL menyediakan toolbar dengan action per tipe: `markdown` → copy, edit (menjadi textarea clay-pressed), simpan ke akun; `terminal` → read-only (tanpa edit), expand/collapse; `image` → copy dan simpan. Action yang tidak berlaku untuk suatu tipe SHALL NOT ditampilkan untuk tipe itu.

#### Scenario: Toolbar terminal

- **WHEN** user melihat artifact tipe `terminal` di canvas
- **THEN** tidak ada tombol edit — hanya expand/collapse (dan copy bila tersedia)

#### Scenario: Simpan markdown ke akun

- **WHEN** user menekan simpan pada artifact markdown
- **THEN** artifact tersimpan ke akun (dashboard catatan) dengan sumber sesi tercatat

### Requirement: Panel terminal untuk output sandbox

Artifact tipe `terminal` SHALL dirender sebagai panel gaya CLI: background clay-pressed, font monospace, menampilkan stdout/stderr asli dari sandbox secara streaming (bukan ringkasan), collapsed by default di dalam step-log dan dapat di-expand oleh siswa.

#### Scenario: Streaming output verifikasi

- **WHEN** Solve-then-Guide menjalankan verifikasi di sandbox
- **THEN** panel terminal menampilkan baris stdout/stderr asli seiring keluar, dan panel itu collapsed sampai siswa membukanya

### Requirement: Step-log SSE yang jujur

Proses Solve-then-Guide SHALL mengirim tahapan sebagai event SSE terpisah dari backend dengan format `event: step` (`{"label", "status": "running|done"}`) dan `event: terminal_output` (`{"line"}`). Setiap label step SHALL mencerminkan tahap asli yang sedang dijalankan backend; sistem SHALL NOT menampilkan step yang dipalsukan/didekoratif di frontend.

#### Scenario: Urutan step nyata

- **WHEN** backend menjalankan solve (rencana → verifikasi sandbox → susun pertanyaan pemandu)
- **THEN** frontend menampilkan step berurutan dengan status running/done yang datang dari event backend, bukan animasi waktu lokal

#### Scenario: Koneksi SSE terputus

- **WHEN** koneksi SSE terputus di tengah proses
- **THEN** step-log menampilkan status terakhir yang diterima secara jujur (tidak melanjutkan animasi palsu), dan user dapat mencoba ulang
