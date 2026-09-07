# Proposal: Eureka Multi Agent System

## Why

Saat ini chat Eureka.AI adalah satu pipeline reaktif: satu model menjawab, satu gaya untuk semua kebutuhan. Empat inisiatif — sistem multi-agent, mode loop tutoring, Artifact Canvas, dan Solve-then-Guide — sampai sekarang direncanakan di dokumen terpisah sehingga berpotensi saling kontradiksi. Proposal ini menyatukannya menjadi satu arsitektur koheren di atas infrastruktur yang sudah ada (`lib/ai.ts` provider chain, `lib/assistant/`, streaming SSE chat, entitlement Pro di `lib/premium.ts`, rate limit di `lib/rateLimit.ts`).

**Masalah yang diselesaikan:**

1. **Tutor menuntun ke arah yang salah** — untuk soal hitungan kompleks, model menjawab langsung tanpa verifikasi; kalau baseline-nya salah, seluruh dialog Socratic menyesatkan.
2. **Tidak ada loop belajar** — chat berhenti di tanya-jawab tunggal; tidak ada siklus act → observe → reflect → decide yang mengukur mastery dan memutuskan langkah berikut.
3. **Output non-percakapan tercampur di bubble chat** — catatan, hasil eksekusi kode, gambar dirender sebagai markdown panjang di dalam bubble, tidak bisa di-copy/edit/simpan sebagai objek tersendiri.
4. **Tidak ada observability per peran** — biaya dan latency sulit diatribusikan karena semua panggilan model lewat jalur yang sama tanpa label agent.

## What Changes

- **6 agent persona** (Kompas/Orchestrator, Socra/Tutor, Lensa/Assessment, Jejak/Note, Palet/Draw, Kilau/Proactive) dengan config model terpusat via `callAgentModel(agentId, prompt, context)` — memakai provider chain existing, bukan arsitektur paralel.
- **Toggle "Eureka Multi Agent"** di prompt box → state machine loop persisten (gather_context → act → observe → reflect → decide) dengan guardrail: max iterasi configurable, exit manual, cap biaya harian, logging per iterasi, feature-flag per user.
- **Solve-then-Guide** (fitur Pro): Astra solve di sandbox eksekusi kode (E2B) terlebih dahulu → susun pertanyaan Socratic mundur dari solusi terverifikasi. Trigger manual atau otomatis dari loop.
- **Artifact Canvas**: panel terpisah dari chat bubble merender 3 tipe artifact (`markdown`, `terminal`, `image`) via streaming parser tag `<artifact>`, dengan toolbar per tipe (copy/edit/simpan).
- **SSE step-log**: event `step` + `terminal_output` yang mencerminkan tahap nyata backend (tanpa step dekoratif).
- **Guardrail lintas sistem**: rate limit per agent, cap biaya Astra terpisah dari cap loop, uji isolasi kegagalan antar-agent.

## Capabilities

### New capabilities

- `multi-agent-routing`: layer routing model per agent + isolasi kegagalan + logging biaya/latency.
- `multi-agent-loop`: toggle Eureka Multi Agent + state machine loop persisten + guardrail + indikator iterasi.
- `artifact-canvas`: panel rendering artifact (markdown/terminal/image), streaming parser tag, toolbar per tipe, SSE step-log.
- `solve-then-guide`: alur solve-terverifikasi-dulu di sandbox + integrasi Pro + trigger manual/otomatis.
- `code-sandbox`: integrasi sandbox eksekusi kode E2B dengan isolasi/ephemeral/resource-limit.

### Modified capabilities

- (tidak ada — pipeline chat existing tetap jalan; mode multi-agent adalah jalur baru yang feature-flagged)

## Impact

- **Backend**: modul agent baru di `lib/agents/`, endpoint SSE baru untuk loop & Solve-then-Guide, store Supabase untuk state loop (patch SQL baru), integrasi E2B SDK di server.
- **Frontend**: komponen toggle di `Composer.tsx`, indikator iterasi di `useAssistantChat.ts`, komponen Artifact Canvas baru di `components/asisten/`, step-log UI.
- **Database**: patch SQL baru untuk tabel state loop + artifact + log iterasi (mengikuti pola `supabase_patch_0XX_*.sql`).
- **Biaya**: panggilan Astra ($10/M in, $50/M out) hanya kondisional; cap harian terpisah mencegah pembengkakan.
- **Risiko**: fitur dirilis bertahap per tahap (routing → loop → canvas markdown → sandbox+StG → guardrail), masing-masing bisa dinonaktifkan via feature flag tanpa memengaruhi chat existing.

## Non-goals (MVP)

- Riset Mendalam (sandbox browsing terpisah), Pendamping Proyek Panjang, Debug Kode Langkah-demi-Langkah — dicatat sebagai fitur turunan, bukan bagian MVP ini.
- Migrasi sandbox ke Piston self-hosted — dievaluasi di tahap 5, bukan bagian implementasi.
- Mengubah pipeline chat non-multi-agent yang sudah berjalan.
