## Purpose

Menyediakan CRUD preferensi AI per user (tingkat kesulitan, gaya bahasa, panjang jawaban, kecepatan, Socratic level, focus mode, bahasa) agar AI bisa menyesuaikan jawaban sesuai kebutuhan belajar individu.

## ADDED Requirements

### Requirement: Manajemen preferensi AI per user

Sistem SHALL menyediakan CRUD preferensi AI per user yang disimpan di database dan dapat diakses via API REST.

#### Scenario: Get preferensi default saat belum ada data
- **WHEN** user pertama kali akses `/api/user/ai-preferences` dan belum ada record
- **THEN** sistem mengembalikan preferensi default (difficulty: "medium", language: "id", responseLength: "medium", speed: "normal", socraticLevel: "medium", focusMode: false, language: "id") dengan status 200

#### Scenario: Get preferensi yang sudah diset
- **WHEN** user sudah pernah set preferensi dan akses `GET /api/user/ai-preferences`
- **THEN** sistem mengembalikan preferensi yang tersimpan dengan status 200

#### Scenario: Update preferensi parsial
- **WHEN** user PATCH `/api/user/ai-preferences` dengan body parsial (mis. hanya `difficulty: "easy"`)
- **THEN** sistem merge dengan preferensi existing dan mengembalikan preferensi terupdate status 200

#### Scenario: Validasi input preferensi
- **WHEN** user kirim nilai invalid (mis. `difficulty: "invalid"`)
- **THEN** sistem menolak dengan 400 dan error detail field yang invalid

#### Scenario: Reset ke default
- **WHEN** user DELETE `/api/user/ai-preferences`
- **THEN** sistem hapus record dan next GET mengembalikan default preferences

### Requirement: Validasi schema preferensi

Sistem SHALL memvalidasi setiap field preferensi sesuai domain nilai yang diizinkan.

#### Scenario: Validasi difficulty
- **WHEN** input `difficulty` bukan salah satu dari `["easy", "medium", "hard"]`
- **THEN** reject dengan error "difficulty harus salah satu dari: easy, medium, hard"

#### Scenario: Validasi language
- **WHEN** input `language` bukan kode ISO 639-1 yang didukung
- **THEN** reject dengan error "language tidak didukung"

#### Scenario: Validasi responseLength
- **WHEN** input `responseLength` bukan salah satu dari `["short", "medium", "long"]`
- **THEN** reject dengan error detail

#### Scenario: Validasi speed
- **WHEN** input `speed` bukan salah satu dari `["fast", "normal", "deep"]`
- **THEN** reject dengan error detail

#### Scenario: Validasi socraticLevel
- **WHEN** input `socraticLevel` bukan angka 1-5
- **THEN** reject dengan error "socraticLevel harus angka 1-5"

### Requirement: Migrasi default untuk user existing

Sistem SHALL menyediakan migrasi otomatis preferensi default untuk user yang belum memiliki record.

#### Scenario: User existing tanpa preferensi
- **WHEN** user existing pertama kali akses preferensi AI
- **THEN** sistem create record default tanpa error

## ADDED Requirements

### Requirement: API endpoints preferensi AI

Sistem SHALL menyediakan REST API endpoints untuk CRUD preferensi.

#### Scenario: GET preferensi
- **WHEN** `GET /api/user/ai-preferences` dengan auth valid
- **THEN** return 200 dengan object preferensi lengkap

#### Scenario: PATCH preferensi
- **WHEN** `PATCH /api/user/ai-preferences` dengan body valid
- **THEN** return 200 dengan preferensi updated

#### Scenario: DELETE reset
- **WHEN** `DELETE /api/user/ai-preferences`
- **THEN** return 204 dan reset ke default

## MODIFIED Requirements

### Requirement: Proteksi akses preferensi

Sistem SHALL memastikan user hanya bisa akses preferensi milik sendiri.

#### Scenario: Akses preferensi user lain
- **WHEN** user A mencoba akses preferensi user B
- **THEN** return 403 Forbidden