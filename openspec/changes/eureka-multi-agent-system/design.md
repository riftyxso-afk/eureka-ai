# Design: Eureka Multi Agent System

## Context

Chat existing berjalan di `app/api/chat/route.ts` (streaming SSE) dengan provider chain di `lib/ai.ts` (`getProviderChain(speedMode, ...)` → Juan Router + fallback OpenRouter). State sesi di `lib/assistant/store.ts`, entitlement Pro via `lib/premium.ts` (`getPremiumStatus`, `FEATURE_LIMITS`), rate limit sliding-window in-memory di `lib/rateLimit.ts`. Streaming UI di `lib/assistant/useAssistantChat.ts` + `components/asisten/Composer.tsx`. Semua di atas Supabase (pola patch SQL `supabase_patch_0XX_*.sql`).

Keputusan arsitektur mengikuti PRD Master (`eureka-master-prd.md` di root repo — sumber kebenaran tunggal). Dokumen ini menetapkan *bagaimana* di atas kode existing.

## Goals / Non-Goals

- Goals: 6 agent dengan model routing configurable; loop tutoring persisten; Artifact Canvas; Solve-then-Guide di sandbox; guardrail biaya; semua tanpa memutus chat existing.
- Non-Goals: sandbox browsing (Riset Mendalam), debug kode langkah-demi-langkah, migrasi Piston (dievaluasi belakangan), arsitektur agent paralel baru.

## Decisions

### D1. Agent sebagai modul di atas `callAgentModel`, bukan framework baru

`lib/agents/` berisi: `catalog.ts` (config per agent: id, persona, model default, tier fallback, limit), `callAgentModel.ts` (abstraksi tunggal yang memanggil `getProviderChain` existing dengan override per agent), `kompas.ts`, `socra.ts`, `lensa.ts`, `jejak.ts`, `palet.ts`, `kilau.ts`.

- `callAgentModel(agentId, prompt, context)` resolves model dari katalog → reuse provider chain + streaming existing. Tidak ada SDK agent, tidak ada HTTP antar-agent — semuanya fungsi dalam satu proses backend.
- **Alternatif yang ditolak**: framework orchestrator (LangGraph dsb.) — dependensi berat, tidak perlu untuk 6 persona yang saling memanggil sebagai fungsi.
- Socra/Lensa yang saat ini tergabung di prompt chat tunggal dipisah: prompt persona Socra (`lib/prompts/`) vs prompt penilaian Lensa yang menghasilkan output terstruktur (JSON mastery delta).

### D2. Loop state machine persisten di Supabase

State loop (topik, fase, iterasi ke-n, goal, log per iterasi) disimpan di tabel `agent_loop_sessions` + `agent_loop_iterations` (patch SQL baru) — bukan memory server — supaya tahan refresh/reconnect. Setiap turn chat dengan toggle ON:

```
gather_context (read Supabase + mastery) → act (Socra) → [await user] →
observe → reflect (Lensa: skor + mastery delta) → decide (Kompas: rules + config)
```

- Fase disimpan per turn, bukan loop tak terbatas di server: backend stateless per request, state lanjut dari DB. Ini cocok dengan arsitektur serverless-friendly existing (`lib/jobQueue`).
- **Decision exit**: `continue_loop | goal_reached | max_iterations | user_stopped | manual_exit` — Kompas memutuskan dari skor Lensa + config (max iterasi default 6, configurable via env/config).
- Toggle OFF di tengah loop = stop **instan**: flag di sesi, dicek di awal tiap turn; iterasi yang sedang jalan tidak dilanjutkan.
- Isolasi kegagalan: try/catch per panggilan agent dalam turn; kegagalan Lensa → skor neutral + lanjut; kegagalan Socra → fallback pesan Kompas; loop tidak crash.

### D3. Artifact: tag streaming + parser toleran

- Backend menandai output non-percakapan dengan tag `<artifact type="markdown|terminal|image" title="...">...</artifact>` di dalam stream.
- Parser (`lib/agents/artifactParser.ts`) bekerja token-by-token: state `idle | in_tag | in_artifact`; tag belum lengkap di-buffer, tidak pernah bocor ke chat bubble. Shared oleh chat renderer existing (pola streaming `MarkdownView`).
- `Artifact` type persis PRD §7.2 (id, type, title, content, version, createdAt, sourceAgent). Version bertambah saat edit via toolbar.
- Canvas UI (`components/asisten/ArtifactCanvas.tsx`): panel samping/desktop terpisah, di mobile jadi bottom sheet. Toolbar per tipe: markdown → copy/edit(textarea clay-pressed)/simpan; terminal → read-only expand/collapse; image → copy/simpan.

### D4. Sandbox: E2B, wrapper dengan interface sendiri

`lib/sandbox/` menyediakan `runCode(code, opts) → {stdout, stderr, exitCode, timedOut}`. E2B SDK di belakang interface ini supaya migrasi ke Piston nanti hanya mengganti adaptor.

- Limit per eksekusi: timeout 10s, memory 256MB, no network, ephemeral (sesuai default E2B + config env), whitelist bahasa mulai Python saja (configurable).
- Dipanggil hanya dari alur Solve-then-Guide dan (kelak) Debug Kode — tidak diekspos ke user sebagai fitur "jalankan kode" umum.

### D5. Solve-then-Guide sebagai fase loop, bukan jalur terpisah

- Trigger: (a) manual — tombol di composer untuk user Pro; (b) otomatis — Kompas mendeteksi sinyal kompleksitas (prompt menyatakan angka besar/persamaan multi-langkah/kode) saat loop ON.
- Alur: step `Membaca soal & menyusun rencana` (Astra) → `Menjalankan verifikasi` (sandbox `runCode`) → `Menyusun pertanyaan pemandu` (Astra reverse-engineer) → Socra lanjut dialog dengan solusi sebagai ground truth.
- Semua tahap dikirim sebagai event SSE `step` + `terminal_output` (stdout/stderr asli, streaming) — format persis PRD §8.4. Step-log UI mengonsumsi event ini; tidak ada step yang disimulasikan di frontend.
- **Entitlement**: cek via `lib/premium.ts` existing (feature baru `solve_then_guide` di `PremiumFeature` + `FEATURE_LIMITS`), bukan sistem flag baru.

### D6. Guardrail & observability

- **Rate limit per agent**: reuse `lib/rateLimit.ts` dengan key `agent:${agentId}:user:${userId}` — bukan cuma per fitur.
- **Cap biaya harian**: dua bucket terpisah per user — `loop` (semua agent non-Astra) dan `astra` (panggilan Solve-then-Guide). Token usage dicatat dari respons model; melewati cap → fallback pesan ramah (Bahas Indonesia, menawarkan lanjut besok).
- **Logging**: tabel `agent_call_logs` (agent, model, durasi ms, token in/out, user, iterasi) — menggantikan/nebeng sistem logging existing; jangan duplikasi. Label iterasi di UI dibaca dari state loop (indikator "Iterasi x/8", hilang saat loop selesai).

## Risks / Trade-offs

- **Biaya Astra**: hanya kondisional + cap harian terpisah; tanpa cap, satu user Pro bisa membakar budget signifikan dalam satu malam.
- [X] Loop state di DB menambah round-trip per turn → diterima; correctness > 1 query tambahan, dan sudah pola existing (chat store).
- [X] Parser tag bisa salah potong bila model menghasilkan tag tidak valid → parser toleran: tag tidak lengkap saat stream selesai di-flush sebagai teks biasa + log warning.
- [X] E2B free tier punya kuota → sandbox dipanggil hanya untuk user Pro + cap; adaptor interface memudahkan pindah Piston.

## Migration Plan

Rilis per tahap (match proposal & PRD §11): routing → toggle+loop → canvas markdown → sandbox+StG+terminal → guardrail. Setiap tahap di belakang feature flag (`FEATURE_MULTI_AGENT`, `FEATURE_SOLVE_THEN_GUIDE` — env/config, bukan hardcode). Chat existing tidak tersentuh sampai Kompas jadi router default (tahap 2, masih di belakang flag per user).

## Open Questions

- Model id "GPT-6 Astra" pada katalog: perlu konfirmasi availability di Juan Router sebelum tahap 4; jika tidak ada, fallback chain Socra-Mendalam dipakai dan Astra tetap configurable.
- Kuota E2B free tier per bulan perlu diukur di tahap 4 sebelum keputusan Piston.
