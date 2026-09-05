## ADDED Requirements

### Requirement: Kutipan sumber wajib untuk jawaban faktual

Sistem SHALL mewajibkan kutipan sumber (RAG atau web) untuk setiap jawaban yang mengandung klaim faktual; jawaban tanpa kutipan SHALL ditahan dan diganti ajakan buat catatan/cari web, sesuai `answer-validation`.

#### Scenario: Jawaban faktual tanpa kutipan ditahan
- **WHEN** asisten menghasilkan jawaban faktual tanpa `*(Sumber: ...)*` dan tanpa hasil web
- **THEN** guardrail menahan jawaban dan mengembalikan ajakan buat catatan, bukan jawaban tanpa sumber

#### Scenario: Jawaban dengan kutipan lolos
- **WHEN** jawaban faktual menyertakan kutipan sumber yang valid
- **THEN** guardrail meloloskan jawaban
