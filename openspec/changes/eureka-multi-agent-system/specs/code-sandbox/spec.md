# Spec Delta: code-sandbox

## ADDED Requirements

### Requirement: Isolasi eksekusi kode

Setiap eksekusi kode SHALL berjalan di container/microVM terpisah yang TIDAK berbagi filesystem atau network dengan service utama. Sandbox SHALL dihancurkan sepenuhnya setelah tiap eksekusi (ephemeral).

#### Scenario: Kode mencoba mengakses service utama

- **WHEN** kode yang dieksekusi mencoba melakukan permintaan jaringan atau mengakses filesystem service utama
- **THEN** akses gagal — sandbox tidak punya network access secara default dan tidak berbagi filesystem dengan service utama

### Requirement: Resource limit per eksekusi

Setiap eksekusi SHALL memiliki resource limit ketat yang configurable: timeout maksimum (default 10 detik), memory (default 256MB), dan CPU terbatas. Eksekusi yang melewati limit SHALL dihentikan dan dilaporkan (bukan menggantung).

#### Scenario: Infinite loop

- **WHEN** kode yang dieksekusi berisi loop tak berujung
- **THEN** eksekusi dihentikan pada batas timeout dan output menandakan eksekusi dihentikan karena timeout

### Requirement: Whitelist bahasa

Sandbox SHALL hanya menerima bahasa yang ada di whitelist yang configurable, dimulai dari Python saja (untuk matematika/sains) dan diperluas bertahap. Bahasa di luar whitelist SHALL ditolak dengan pesan yang jelas.

#### Scenario: Bahasa di luar whitelist

- **WHEN** permintaan eksekusi meminta bahasa yang tidak ada di whitelist (mis. C++ saat whitelist baru Python)
- **THEN** permintaan ditolak dengan pesan yang menjelaskan bahasa yang tersedia

### Requirement: Adaptor provider dengan interface sendiri

Sandbox SHALL dipanggil melalui interface internal `runCode(code, opts) → {stdout, stderr, exitCode, timedOut}` dengan provider pertama E2B (free tier), sehingga migrasi ke provider lain (mis. Piston self-hosted) hanya mengganti adaptor tanpa mengubah pemanggil. Sandbox eksekusi kode ini SHALL tetap terpisah dari sandbox riset/browsing bila kelak dibuat.

#### Scenario: Panggilan dari Solve-then-Guide

- **WHEN** alur Solve-then-Guide menjalankan verifikasi numerik
- **THEN** ia memanggil interface `runCode` internal, tanpa tahu provider di belakangnya

#### Scenario: Provider tidak tersedia

- **WHEN** provider sandbox gagal atau kuota habis
- **THEN** pemanggil menerima error terstruktur (bukan hang), dan alur Solve-then-Guide menangginya sesuai skenario gagal-verifikasi-nya
