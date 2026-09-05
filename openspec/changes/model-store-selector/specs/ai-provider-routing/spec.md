# Spec Delta: ai-provider-routing

## MODIFIED Requirements

### Requirement: Semua generate teks memakai Juan Router sebagai provider utama

Setiap permintaan generate teks — chat asisten, pembuatan catatan dari YouTube/web/dokumen, kuis, flashcards, judul sesi, prompt ilustrasi, dan enrichment web-search — SHALL dikirim ke Juan Router sebagai provider utama. Pemilihan model mengikuti tier kecepatan yang diminta user (Kilat/Seimbang/Mendalam), termasuk penyaringan model thinking saat reasoning dimatikan. Daftar tier memakai katalog Juan Router terkini:

- **Kilat**: `glm-5.3-flash`, `gemini-3.8-flash-high`, `gemini-3.7-flash-low`, `nemotron-3.5-lightning`
- **Seimbang**: `gpt-5.6-luna`, `minimax-m3`, `hy-4-preview`, `grok-4.5-high`
- **Mendalam**: `gpt-5.6-sol`, `gpt-5.6-terra`, `claude-opus-5`, `qwen3.8-max`, `grok-4.6-xhigh`

Bila user memilih model spesifik di Model Store (chat saja), model terpilih SHALL dicoba PALING AWAL, lalu disusul sisa daftar tier-nya sebagai fallback. Model yang tidak tersedia di Juan Router tetap berada di daftar; saat ditolak (503/model_not_found), rantai lanjut otomatis ke model berikutnya tanpa memutus permintaan.

#### Scenario: Chat asisten memakai Juan Router

- **WHEN** user mengirim pesan chat dengan mode kecepatan apa pun
- **THEN** permintaan dikirim ke Juan Router dengan model dari tier kecepatan tersebut, dan TIDAK dikirim ke OpenAgentic

#### Scenario: Pembuatan catatan memakai Juan Router

- **WHEN** user memicu pemrosesan catatan (YouTube, artikel web, atau dokumen)
- **THEN** seluruh langkah generate teks dalam pipeline catatan (ekstraksi terstruktur, ringkasan, kuis, flashcards) dikirim ke Juan Router, bukan OpenAgentic

#### Scenario: Mode reasoning nonaktif

- **WHEN** user mematikan toggle reasoning
- **THEN** model thinking dikecualikan dari daftar model yang dicoba, dan permintaan tetap dikirim ke Juan Router

#### Scenario: Model spesifik dipilih user

- **WHEN** user memilih model spesifik di Model Store lalu mengirim chat
- **THEN** model itu menjadi percobaan pertama di rantai Juan Router, disusul model tier aktif sebagai fallback

#### Scenario: Model di daftar tidak tersedia di Juan

- **WHEN** model dalam tier (mis. `claude-opus-5`) ditolak Juan Router karena tidak ada channel-nya
- **THEN** sistem otomatis mencoba model berikutnya di tier yang sama, dan hanya naik ke fallback OpenRouter bila seluruh Juan habis
