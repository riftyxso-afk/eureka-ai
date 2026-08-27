# dashboard-hub Delta

## Purpose

Menjadikan Dashboard satu-satunya pusat aplikasi: seluruh kemampuan asisten AI dari halaman Home (prompt composer, riwayat sesi, intent buat catatan/gambar) hidup di Dashboard, disusun responsif agar tidak pernah sempit, dengan redirect dari jalur-jalur lama.

## ADDED Requirements

### Requirement: Composer asisten utama berada di Dashboard

Dashboard SHALL menampilkan prompt composer AI utama (input teks, lampiran catatan, indikator web search) beserta thread percakapan dan riwayat sesi chat yang sebelumnya dimiliki halaman Home; seluruh kemampuan intent — membuat catatan dari prompt dan menghasilkan gambar — SHALL tetap berfungsi dari composer Dashboard.

#### Scenario: Mengirim prompt dari Dashboard

- **WHEN** pengguna mengetik pertanyaan pada composer di Dashboard lalu mengirim
- **THEN** jawaban asisten tampil dalam thread di Dashboard tanpa berpindah halaman

#### Scenario: Prompt "buatkan catatan" dari Dashboard

- **WHEN** pengguna menulis prompt berniat membuat catatan pada composer Dashboard
- **THEN** alur pembuatan catatan (overlay progres) berjalan seperti sebelumnya dari Home

#### Scenario: Riwayat sesi chat dapat dibuka

- **WHEN** pengguna membuka daftar sesi chat dari Dashboard
- **THEN** riwayat percakapan sebelumnya dapat dilihat dan dilanjutkan

### Requirement: Layout Dashboard tidak sempit

Dashboard SHALL menyusun area asisten dan ringkasan aktivitas (statistik + catatan) dengan layout responsif: pada layar lebar keduanya tampil berdampingan sebagai kolom penuh; pada layar kecil keduanya tersusun dalam tab/panel terpisah — teks, kartu, dan composer TIDAK BOLEH tergencet atau turun keterbacaannya karena berbagi ruang yang terlalu kecil.

#### Scenario: Desktop lewar dua kolom

- **WHEN** pengguna membuka Dashboard pada viewport lebar (≥ 1280px)
- **THEN** area asisten dan ringkasan aktivitas tampil berdampingan, masing-masing dengan lebar kolom penuh yang layak

#### Scenario: Mobile memakai tab

- **WHEN** pengguna membuka Dashboard pada viewport sempit (< 1024px)
- **THEN** konten terbagi dalam tab/panel (mis. "Asisten" dan "Aktivitas") sehingga tiap bagian mendapat lebar penuh layar

### Requirement: Jalur lama menuju Home dialihkan ke Dashboard

Akses ke `/home` — baik langsung, setelah login (default `getSafeNext`), maupun tautan internal lama — SHALL membawa pengguna ke Dashboard; tidak ada lagi alur utama yang mendarat atau tinggal di halaman Home.

#### Scenario: Membuka /home langsung

- **WHEN** pengguna membuka URL `/home`
- **THEN** ia diarahkan ke `/dashboard` dan seluruh fungsi asisten tersedia di sana

#### Scenario: Login tanpa parameter next

- **WHEN** pengguna berhasil login tanpa parameter `next`
- **THEN** ia mendarat di `/dashboard`, bukan `/home`

### Requirement: Prompt tertunda mendarat di composer Dashboard

Mekanisme prompt tertunda dari halaman lain (PENDING_PROMPT_KEY) SHALL mengarah ke composer Dashboard: saat Dashboard dibuka dengan prompt tertunda, prompt tersebut terisi otomatis dan terkirim sesuai perilaku lama.

#### Scenario: Prompt dikirim dari halaman catatan

- **WHEN** pengguna memicu "tanya asisten" dari halaman lain lalu mendarat di Dashboard
- **THEN** prompt tertunda otomatis terisi dan diproses oleh composer Dashboard
