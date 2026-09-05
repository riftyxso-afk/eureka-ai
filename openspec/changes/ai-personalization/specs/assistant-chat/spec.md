## MODIFIED Requirements

### Requirement: System prompt injection preferensi user (modified)

Sistem SHALL memodifikasi `buildSystemPrompt` untuk menerima dan meng-inject `userPreferences` ke system prompt.

#### Scenario: System prompt dengan preferensi lengkap
- **WHEN** `buildSystemPrompt` dipanggil dengan `userPreferences` object
- **THEN** system prompt mengandung section `=== USER PREFERENCES ===` dengan preferensi terformat:
  - `difficulty: easy` → "Gunakan bahasa sederhana, hindari jargon, berikan analogi sehari-hari"
  - `responseLength: short` → "Jawab singkat maksimal 3 kalimat, fokus poin utama"
  - `socraticLevel: 5` → "Selalu tanya balik untuk memastikan pemahaman, jangan beri jawaban langsung"
  - `focusMode: true` → "Fokus pada satu konsep per jawaban, hindari tanggul"
  - `language: en` → "Always respond in English"

#### Scenario: Preferensi parsial
- **WHEN** user hanya set sebagian preferensi (mis. hanya `difficulty: easy`)
- **THEN** hanya inject preferensi yang diset, sisanya pakai default

### Requirement: Validasi response AI sesuai preferensi (modified)

Sistem SHALL memvalidasi response AI sebelum dikirim ke user sesuai preferensi.

#### Scenario: Validasi panjang jawaban
- **WHEN** user `responseLength: "short"` tapi AI jawab >5 kalimat
- **THEN** sistem potong ke 3 kalimat pertama + "..." + link "Baca selengkapnya"

#### Scenario: Validasi bahasa
- **WHEN** user `language: "id"` tapi AI jawab English
- **THEN** sistem auto-translate ke Bahasa Indonesia via LLM call kedua

#### Scenario: Validasi Socratic level
- **WHEN** user `socraticLevel: 5` tapi AI jawab langsung tanpa tanya balik
- **THEN** sistem append ke jawaban: "Apakah penjelasan ini cukup jelas? Mau saya jelaskan bagian mana lebih detail?"

#### Scenario: Focus mode
- **WHEN** user `focusMode: true` tapi AI jawab melenceng topik
- **THEN** sistem prepend: "[Fokus] " + jawaban yang difilter hanya topik utama