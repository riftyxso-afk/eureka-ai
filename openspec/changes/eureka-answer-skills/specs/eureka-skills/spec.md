## Purpose

Menyediakan registry skills Eureka yang memilih gaya jawaban (Socratic, fact-check, stepwise) secara otomatis atau manual agar jawaban konsisten dan sesuai intent.

## ADDED Requirements

### Requirement: Registry skills terpusat

Sistem SHALL menyediakan registry `eureka-skills` berisi skill `socratic-explain`, `fact-check`, `source-cite`, `stepwise-solve`, `default`; tiap skill SHALL mendefinisikan `when` (trigger), `prompt` (instruksi), `tools` (RAG/web/math), dan `validator`.

#### Scenario: Skill terdaftar
- **WHEN** sistem memuat registry saat start
- **THEN** kelima skill tersedia dengan `when`/`prompt`/`validator` terisi

#### Scenario: Skill tidak ditemukan fallback
- **WHEN** `skill` yang diminta tidak ada di registry
- **THEN** sistem memakai `default`

### Requirement: Selector otomatis dan manual

Sistem SHALL memilih skill otomatis berdasar intent pertanyaan (kata kunci `jelaskan`→`socratic-explain`, `apakah benar`→`fact-check`, `hitung`/`rumus`→`stepwise-solve`, klaim faktual→`source-cite`), dan SHALL menghormati override manual `skill:` dari composer jika ada.

#### Scenario: Intent jelaskan
- **WHEN** user bertanya "jelaskan fotosintesis"
- **THEN** selector memilih `socratic-explain`

#### Scenario: Override manual
- **WHEN** user mengirim `skill:fact-check Apakah bumi datar?`
- **THEN** sistem pakai `fact-check` walau intent lain terdeteksi

#### Scenario: Tidak cocok
- **WHEN** pertanyaan tidak cocok ke 4 skill inti
- **THEN** sistem pakai `default`

### Requirement: Logging skill yang dipakai

Sistem SHALL mencatat `skill_used` (nama skill, confidence, sumber) ke log/telemetry untuk setiap jawaban, tanpa menyimpan isi jawaban.

#### Scenario: Jawaban sukses
- **WHEN** jawaban selesai di-stream
- **THEN** log berisi `skill_used: step-wise-solve` dan `confidence: 0.8`

### Requirement: UI badge skill

Sistem SHALL menampilkan badge skill yang dipakai di bubble assistant dan menyediakan kontrol ganti skill (dropdown) di composer, tanpa mengubah API chat yang ada.

#### Scenario: Badge terlihat
- **WHEN** assistant menjawab dengan `fact-check`
- **THEN** bubble menampilkan badge "Fact-check"

#### Scenario: Ganti skill
- **WHEN** user ganti skill di composer sebelum kirim
- **THEN** pesan berikutnya dikirim dengan `skill` yang dipilih
