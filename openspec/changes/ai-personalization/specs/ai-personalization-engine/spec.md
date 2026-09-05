## Purpose

Menyediakan engine personalisasi yang meng-inject preferensi user ke system prompt secara dinamis dan memvalidasi response AI sesuai preferensi user sebelum ditampilkan.

## ADDED Requirements

### Requirement: Inject preferensi ke system prompt dinamis

Sistem SHALL meng-inject preferensi user ke system prompt secara dinamis saat build prompt untuk AI chat.

#### Scenario: Inject difficulty level
- **WHEN** user dengan `difficulty: "easy"` bertanya konsep kompleks
- **THEN** system prompt mengandung instruksi "Gunakan bahasa sederhana, hindari jargon teknis, berikan analogi sehari-hari"

#### Scenario: Inject response length
- **WHEN** user dengan `responseLength: "short"` bertanya
- **THEN** system prompt mengandung "Jawab singkat maksimal 3 kalimat, fokus poin utama"

#### Scenario: Inject socratic level
- **WHEN** user dengan `socraticLevel: 5` bertanya
- **THEN** system prompt mengandung "Selalu tanya balik untuk memastikan pemahaman, jangan beri jawaban langsung"

#### Scenario: Inject focus mode
- **WHEN** user enable `focusMode: true`
- **THEN** system prompt mengandung "Fokus pada satu konsep per jawaban, hindari tanggul"

#### Scenario: Inject language
- **WHEN** user dengan `language: "en"`
- **THEN** system prompt dalam English dan instruksi "Always respond in English"

### Requirement: Validasi response AI sesuai preferensi

Sistem SHALL memvalidasi response AI sebelum dikirim ke user sesuai preferensi.

#### Scenario: Validasi panjang jawaban
- **WHEN** user `responseLength: "short"` tapi AI jawab >5 kalimat
- **THEN** sistem potong/minta regenerasi ke ≤3 kalimat

#### Scenario: Validasi bahasa
- **WHEN** user `language: "id"` tapi AI jawab dalam English
- **THEN** sistem minta regenerasi atau auto-translate

#### Scenario: Validasi Socratic level
- **WHEN** user `socraticLevel: 5` tapi AI jawab langsung tanpa tanya balik
- **THEN** sistem minta regenerasi dengan tanya balik

### Requirement: Fallback graceful saat preferensi error

Sistem SHALL handle error preferensi dengan graceful degradation.

#### Scenario: Preferensi corrupt/tidak valid
- **WHEN** record preferensi corrupt di DB
- **THEN** fallback ke default preferences tanpa error, log warning

#### Scenario: API preferensi timeout
- **WHEN** fetch preferensi >2 detik
- **THEN** gunakan default preferences, log warning, lanjutkan chat

## MODIFIED Requirements

### Requirement: System prompt generation (modified)

Sistem SHALL memodifikasi `buildSystemPrompt` untuk menerima dan meng-inject preferensi user.

#### Scenario: System prompt dengan preferensi lengkap
- **WHEN** `buildSystemPrompt` dipanggil dengan `userPreferences` object
- **THEN** system prompt mengandung section `=== USER PREFERENCES ===` dengan preferensi terformat