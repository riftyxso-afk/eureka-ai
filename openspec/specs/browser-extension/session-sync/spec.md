## Purpose

Memungkinkan ekstensi browser menggunakan session login yang sudah aktif di website Eureka.AI, sehingga user tidak perlu login ulang melalui OTP email saat memasang ekstensi.

## ADDED Requirements

### Requirement: Session detection from website
Ekstensi SHALL mendeteksi session Supabase yang aktif di website `eureka-ai.web.id` dan menggunakan token tersebut untuk login otomatis.

#### Scenario: User sudah login di website
- **WHEN** user membuka ekstensi dan memiliki session valid di website `eureka-ai.web.id`
- **THEN** ekstensi langsung masuk ke view chat tanpa meminta OTP

#### Scenario: Session website tidak ada atau expired
- **WHEN** user membuka ekstensi dan tidak ada session valid di website
- **THEN** ekstensi menampilkan form login OTP seperti biasa

### Requirement: Cross-domain session token exchange
Ekstensi SHALL menukar session token dari website dengan session token ekstensi melalui endpoint backend yang aman.

#### Scenario: Token exchange berhasil
- **WHEN** ekstensi mengirim session token website ke `/api/auth/session-exchange`
- **THEN** backend memvalidasi token dan mengembalikan session token ekstensi yang valid

#### Scenario: Token exchange gagal
- **WHEN** token website tidak valid atau expired
- **THEN** backend mengembalikan error 401 dan ekstensi menampilkan form login

### Requirement: Session persistence
Session ekstensi SHALL persist di `chrome.storage.local` dan validasi ulang secara berkala.

#### Scenario: Session masih valid
- **WHEN** session tersimpan di storage dan belum expired
- **THEN** ekstensi langsung masuk ke view chat saat dibuka

#### Scenario: Session expired
- **WHEN** session tersimpan tapi sudah expired
- **THEN** ekstensi mencoba refresh token, jika gagal menampilkan form login

### Requirement: Seamless login flow
Login ekstensi SHALL menawarkan opsi "Login via Website" yang membuka popup website untuk OAuth/OTP.

#### Scenario: User memilih login via website
- **WHEN** user mengklik tombol "Login via Website"
- **THEN** popup website terbuka, user login, dan session otomatis tersinkron ke ekstensi

#### Scenario: User memilih login manual
- **WHEN** user mengklik tombol "Login dengan Email"
- **THEN** form OTP ditampilkan seperti biasa
