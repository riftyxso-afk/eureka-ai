## Purpose

Memastikan transport dan respons HTTP (CORS, security headers, error handling), serta tata kelola rahasia (env, git, log, bundle client) tidak membocorkan rahasia atau memperluas permukaan serangan.

## ADDED Requirements

### Requirement: CORS hanya mengizinkan origin terdaftar

Backend API WAJIB hanya mengizinkan origin yang terdaftar di konfigurasi `CORS_ORIGIN`. Konfigurasi wildcard `*` yang dipasangkan dengan `credentials` TIDAK boleh berlaku di produksi. Origin tidak terdaftar TIDAK boleh menerima header CORS yang mengizinkan permintaan ber-credentials.

#### Scenario: Origin tidak terdaftar
- **WHEN** permintaan browser berasal dari origin yang tidak terdaftar di CORS_ORIGIN
- **THEN** respons tidak memuat header CORS yang mengizinkan origin tersebut (browser memblokir)

#### Scenario: Origin terdaftar
- **WHEN** permintaan browser berasal dari origin yang terdaftar di CORS_ORIGIN
- **THEN** respons memuat header CORS yang mengizinkan origin tersebut dengan credentials

### Requirement: Security headers pada semua respons

Semua respons HTTP aplikasi (halaman dan API) WAJIB memuat security headers: Content-Security-Policy, `X-Content-Type-Options: nosniff`, frame protection (X-Frame-Options / CSP frame-ancestors), Referrer-Policy, dan Permissions-Policy. Di produksi HTTPS, Strict-Transport-Security WAJIB ada.

#### Scenario: Respons halaman memuat headers
- **WHEN** browser menerima respons halaman atau API
- **THEN** respons memuat CSP, nosniff, frame protection, Referrer-Policy, dan Permissions-Policy

#### Scenario: Header tidak boleh bocor di respons non-HTML
- **WHEN** respons adalah API JSON
- **THEN** security headers tetap terpasang

### Requirement: Error respons tidak membocorkan detail internal

Pesan error yang dikembalikan ke client TIDAK boleh memuat pesan exception mentah, stack trace, path internal, atau nilai rahasia. Detail teknis hanya boleh masuk ke log server.

#### Scenario: Exception pada handler
- **WHEN** terjadi exception di handler API
- **THEN** client menerima pesan error generik (mis. "Terjadi kesalahan") tanpa isi exception, dan detail lengkap tercatat di log server

### Requirement: Rahasia tidak pernah terekspos

Nilai rahasia (service role key, API key AI, token, kredensial DB) TIDAK boleh muncul di: file yang ter-track git, bundle JavaScript client, log aplikasi, atau respons API. Hanya nilai publik yang boleh menggunakan prefix `NEXT_PUBLIC_`. Repositori WAJIB lolos pemindaian rahasia (secret scan) sebelum rilis.

#### Scenario: Secret scan pada repositori
- **WHEN** repositori dipindai untuk rahasia (mis. service role key, sk-* keys)
- **THEN** tidak ditemukan nilai rahasia valid di file yang ter-track git

#### Scenario: Bundle client bebas rahasia
- **WHEN** bundle JavaScript sisi client diinspeksi
- **THEN** tidak memuat service role key, API key AI, atau rahasia lain

#### Scenario: Log tidak memuat rahasia
- **WHEN** log aplikasi diperiksa
- **THEN** tidak memuat nilai rahasia apa pun

### Requirement: Rate limiting pada endpoint publik yang mahal

Endpoint yang memicu biaya atau dapat disalahgunakan (chat AI, tanya catatan, generate konten, OTP) WAJIB memiliki rate limit per pengguna/IP. Permintaan melebihi batas WAJIB ditolak dengan status 429.

#### Scenario: Burst permintaan melebihi batas
- **WHEN** satu pengguna/IP mengirim permintaan melebihi batas dalam jendela waktu
- **THEN** permintaan ditolak dengan status 429 dan tidak diproses