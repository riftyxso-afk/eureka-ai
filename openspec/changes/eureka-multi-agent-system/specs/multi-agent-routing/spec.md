# Spec Delta: multi-agent-routing

## ADDED Requirements

### Requirement: Katalog agent dan routing model terpusat

Sistem SHALL mendefinisikan enam agent persona — Kompas (Orchestrator), Socra (Tutor), Lensa (Assessment), Jejak (Note/Summarizer), Palet (Draw), Kilau (Proactive) — dengan config model per agent yang disimpan terpusat di satu katalog (agent id, persona, model default, rantai fallback, limit), bukan hardcode di logika tiap agent. Seluruh pemanggilan model dari agent mana pun SHALL melewati satu abstraksi `callAgentModel(agentId, prompt, context)` yang men-resolve model dari katalog tersebut dan memakai provider chain existing (Juan Router → fallback).

#### Scenario: Socra naik kelas ke model kondisional

- **WHEN** konfigurasi Socra menetapkan model kondisional untuk soal sulit (mis. Astra via Solve-then-Guide)
- **THEN** perubahan model dilakukan lewat katalog/konfigurasi tanpa mengubah kode inti agent

#### Scenario: Agent memanggil model

- **WHEN** salah satu agent menjalankan tugasnya (tutoring, penilaian, ringkas, gambar, proaktif)
- **THEN** panggilan modelnya keluar melalui `callAgentModel` dengan agentId-nya, bukan memanggil provider secara langsung

### Requirement: Isolasi kegagalan antar-agent

Kegagalan atau timeout satu agent SHALL NOT menjatuhkan sesi chat secara keseluruhan. Orchestrator (Kompas) SHALL menghasilkan respons fallback yang wajar berbahasa Indonesia bila agent yang diarahkan gagal.

#### Scenario: Lensa gagal menilai jawaban

- **WHEN** Lensa timeout atau error saat menilai jawaban siswa di dalam loop
- **THEN** turn tetap selesai dengan skor netral, pesan ke siswa tidak terputus, dan kegagalan dicatat di log

#### Scenario: Socra gagal merespons

- **WHEN** Socra gagal menghasilkan pertanyaan/langkah berikutnya
- **THEN** Kompas mengirim pesan fallback yang wajar dan loop tidak crash

### Requirement: Logging biaya dan latency per agent

Setiap pemanggilan `callAgentModel` SHALL mencatat: agent id, model yang dipakai, durasi, token masuk/keluar, user, dan iterasi loop (bila ada) ke store log yang persisten. Logging ini SHALL reuse infrastruktur penyimpanan existing (Supabase), bukan sistem duplikat.

#### Scenario: Evaluasi biaya per peran

- **WHEN** admin menganalisis pemakaian
- **THEN** biaya dan latency dapat diatribusikan per agent dan per model dari data log

### Requirement: Rate limit per agent

Sistem SHALL menerapkan rate limit per kombinasi agent dan user (key `agent:{agentId}:user:{userId}`), terpisah dari rate limit per fitur yang sudah ada, dengan memakai mekanisme rate limit sliding-window existing.

#### Scenario: Satu agent melewati batas

- **WHEN** pemanggilan satu agent untuk seorang user melewati limit di jendela waktu
- **THEN** hanya pemanggilan agent itu yang ditahan; agent lain dan fitur chat biasa tetap berjalan
