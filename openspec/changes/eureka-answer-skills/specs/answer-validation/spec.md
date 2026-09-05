## Purpose

Memastikan jawaban Eureka yang mengandung klaim faktual divalidasi terhadap sumber (catatan RAG/web) dan format (LaTeX/math) sebelum ditampilkan agar lebih akurat dan valid.

## ADDED Requirements

### Requirement: Kutipan sumber wajib untuk klaim faktual

Sistem SHALL menolak atau menandai jawaban yang mengandung klaim faktual tanpa kutipan sumber dari RAG atau web search; untuk klaim faktual, jawaban SHALL memuat minimal satu kutipan `*(Sumber: ...)*` yang merujuk ke potongan RAG atau hasil web.

#### Scenario: Klaim tanpa sumber
- **WHEN** jawaban mengandung "Fotosintesis terjadi di kloroplas" tanpa kutipan
- **THEN** validator menolak dan sistem menambah ajakan "buat catatan" atau meminta sumber

#### Scenario: Klaim dengan sumber
- **WHEN** jawaban mengandung klaim dan ada `*(Sumber: Catatan "Biologi", Bab 1)*`
- **THEN** validator lolos

### Requirement: Validasi LaTeX/math

Sistem SHALL memeriksa setiap rumus LaTeX memakai delimiter `$...$` atau `$$...$$` dapat dirender KaTeX tanpa error; rumus kompleks (`\frac`, `\sqrt`) SHALL memakai `$$...$$`, dan rumus yang gagal render SHALL ditandai.

#### Scenario: LaTeX valid
- **WHEN** jawaban mengandung `$$E=mc^2$$`
- **THEN** validator lolos

#### Scenario: LaTeX tanpa delimiter
- **WHEN** jawaban mengandung `\frac{a}{b}` tanpa `$`
- **THEN** validator menandai dan sistem membungkus ulang atau minta perbaikan

### Requirement: Validasi konsistensi bahasa

Sistem SHALL memastikan bahasa jawaban konsisten dengan bahasa pertanyaan/locale user (id/en), kecuali user minta campur.

#### Scenario: Pertanyaan Bahasa Indonesia
- **WHEN** user bertanya dalam Bahasa Indonesia
- **THEN** jawaban dalam Bahasa Indonesia

#### Scenario: Minta campur
- **WHEN** user minta "Campuran"
- **THEN** jawaban boleh campur

### Requirement: Penolakan halus tanpa sumber

Sistem SHALL bila tidak ada sumber RAG/web yang relevan, menjawab jujur "tidak ada di materi" dan menawarkan buat catatan/cari web, bukan mengarang kutipan.

#### Scenario: Tidak ada sumber
- **WHEN** RAG kosong dan web dimatikan, user tanya materi
- **THEN** jawaban: "Tidak ada di catatanmu, mau buat catatan dari link?" tanpa kutipan palsu
