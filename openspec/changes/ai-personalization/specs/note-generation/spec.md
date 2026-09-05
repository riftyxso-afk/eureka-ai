## MODIFIED Requirements

### Requirement: Generate catatan sesuai preferensi user (modified)

Sistem SHALL memodifikasi pipeline pembuatan catatan untuk mempertimbangkan preferensi user.

#### Scenario: Difficulty level mempengaruhi depth catatan
- **WHEN** user `difficulty: "easy"` buat catatan dari materi kompleks
- **THEN** catatan menggunakan bahasa sederhana, analogi sehari-hari, Hindari jargon, Tambahkan "Contoh nyata:" di setiap konsep

#### Scenario: Response length mempengaruhi panjang catatan
- **WHEN** user `responseLength: "short"` buat catatan
- **THEN** catatan maksimal 300 kata, hanya poin kunci, tanpa penjelasan panjang

#### Scenario: Language mempengaruhi bahasa catatan
- **WHEN** user `language: "en"` buat catatan
- **THEN** seluruh catatan (judul, heading, content) dalam English

#### Scenario: Socratic level mempengaruhi struktur catatan
- **WHEN** user `socraticLevel: 5` buat catatan
- **THEN** setiap section diakhiri dengan "Pertanyaan refleksi:" + 1-2 pertanyaan pemahaman

### Requirement: Validasi output catatan sesuai preferensi

Sistem SHALL memvalidasi output catatan sebelum disimpan.

#### Scenario: Validasi panjang catatan
- **WHEN** user `responseLength: "short"` tapi catatan >500 kata
- **THEN** sistem ringkas ulang via LLM call kedua ke ≤300 kata

#### Scenario: Validasi bahasa catatan
- **WHEN** user `language: "id"` tapi output mengandung >20% kata English
- **THEN** sistem auto-translate section yang non-Indonesia