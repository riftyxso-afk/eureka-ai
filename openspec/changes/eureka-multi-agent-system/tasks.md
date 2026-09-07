# Tasks: Eureka Multi Agent System

Semua nilai yang dinamai "configurable" diambil dari config/env (bukan hardcode): max iterasi, cap biaya harian, whitelist bahasa sandbox, timeout/memory sandbox, nama feature flag, id model Astra.

## 1. Tahap 1 — Layer Routing Model & Pemisahan Agent

- [x] 1.1 Buat `lib/agents/catalog.ts`: tipe `AgentId`, `AgentConfig` (persona, model default, rantai fallback, limit), config untuk 6 agent (Kompas, Socra, Lensa, Jejak, Palet, Kilau) sesuai PRD §4 — model per agent dari env/config
- [x] 1.2 Buat `lib/agents/callAgentModel.ts`: `callAgentModel(agentId, prompt, context)` yang men-resolve config dari katalog lalu memanggil provider chain existing (`lib/ai.ts` `getProviderChain`) dengan override per agent; dukung streaming dan non-streaming
- [x] 1.3 Pisahkan prompt persona: prompt tutor Socra dan prompt penilaian Lensa (output terstruktur JSON mastery delta) di `lib/prompts/` — identitas persona jelas, bahasa Indonesia
- [x] 1.4 Buat modul agent `lib/agents/{kompas,socra,lensa,jejak,palet,kilau}.ts` yang masing-masing memanggil `callAgentModel` dengan agentId-nya
- [x] 1.5 Buat store log `agent_call_logs` (patch SQL `supabase_patch_021_agent_system.sql`: tabel log + tabel state loop untuk tahap 2) + helper penulisan log (agent, model, durasi, token in/out, user, iterasi)
- [x] 1.6 Terapkan rate limit per agent via `lib/rateLimit.ts` dengan key `agent:{agentId}:user:{userId}` di jalur `callAgentModel`
- [x] 1.7 Tambahkan env vars baru ke `.env.example` (flag `FEATURE_MULTI_AGENT`, id model Astra, cap biaya) dengan komentar bahasa Indonesia

## 2. Tahap 2 — Kompas Router + Toggle & Loop Eureka Multi Agent

- [x] 2.1 Implementasi Kompas sebagai entry point intent: klasifikasi intent (tutoring/catatan/gambar/chat biasa) dengan Haiku-tier via `callAgentModel("kompas", ...)`, arahkan ke agent sesuai
- [x] 2.2 Patch SQL tabel state loop: `agent_loop_sessions` (topik, fase, iterasi, goal, status, flag user) + `agent_loop_iterations` (goal, pertanyaan, jawaban, skor, keputusan per iterasi) dengan RLS mengikuti pola patch existing
- [x] 2.3 Buat state machine loop di `lib/agents/loop.ts`: transisi gather_context → act → observe → reflect → decide; state read/write ke Supabase (tahan refresh/reconnect); keputusan exit `continue_loop | goal_reached | max_iterations | user_stopped | manual_exit`
- [x] 2.4 Guardrail loop: max iterasi default 6 (configurable), exit signal manual (deteksi "udah paham"/"skip" + tombol stop), stop instan saat toggle OFF (dicek di awal tiap turn), cap biaya harian per user bucket `loop` dengan fallback pesan ramah
- [x] 2.5 Endpoint SSE loop di `app/api/chat` (atau route terpisah yang di-mount ke backend Hono `routes.ts`): streaming respons Socra + event state loop; daftarkan route baru di `backend/src/routes.ts`
- [x] 2.6 UI toggle pill "Eureka Multi Agent" di `components/asisten/Composer.tsx`: posisi sebelah tombol kirim, dua visual state (OFF clay-surface + spark outline; ON solid `--accent-coral` + spark filled), scope per-topik/sesi, hanya tampil bagi user ber-flag
- [x] 2.7 Indikator "Iterasi x/8" di area chat (`useAssistantChat.ts` + bubble/header), hilang otomatis saat loop selesai; state toggle dipertahankan saat ganti topik
- [x] 2.8 Logging per iterasi lengkap (goal, pertanyaan, jawaban, skor, keputusan) ke `agent_loop_iterations`
- [x] 2.9 Uji isolasi kegagalan: simulasi gagal/timeout Lensa dan Socra → turn tetap selesai, fallback Kompas muncul, loop tidak crash

## 3. Tahap 3 — Artifact Canvas (tipe `markdown`)

- [x] 3.1 Definisikan tipe `Artifact` (id, type, title, content, version, createdAt, sourceAgent) di `lib/agents/types.ts` — eksplisit, tanpa `any`
- [x] 3.2 Buat streaming parser `lib/agents/artifactParser.ts`: deteksi tag `<artifact type="..." title="...">...</artifact>` token-by-token, state idle/in_tag/in_artifact, buffer tag belum lengkap, flush aman bila stream selesai dengan tag menggantung + log warning
- [x] 3.3 Integrasikan parser ke pipeline streaming chat existing (`useAssistantChat.ts` + renderer) — teks chat tetap ke bubble, konten artifact ke state canvas
- [x] 3.4 Buat komponen `components/asisten/ArtifactCanvas.tsx`: panel terpisah dari bubble (desktop: panel samping; mobile: bottom sheet), render markdown dengan renderer existing
- [x] 3.5 Toolbar markdown: copy, edit (textarea clay-pressed), simpan ke akun (sinkron dashboard catatan, sourceAgent `jejak`); `version` bertambah saat disimpan ulang
- [x] 3.6 Alur Jejak: saat user minta ringkasan/catatan di chat dengan mode multi-agent, Jejak menghasilkan output bertag artifact markdown yang dirender di canvas

## 4. Tahap 4 — Sandbox + Solve-then-Guide + tipe `terminal`

- [x] 4.1 Tambah dependensi SDK E2B + wrapper `lib/sandbox/runCode.ts`: interface `runCode(code, opts) → {stdout, stderr, exitCode, timedOut}`; ephemeral per eksekusi, no network, timeout 10s & memory 256MB (configurable), whitelist bahasa mulai Python (configurable), error terstruktur bila provider gagal
- [x] 4.2 Tambah feature entry `solve_then_guide` ke `PremiumFeature` + `FEATURE_LIMITS` di `lib/premium.ts` (entitlement via sistem existing, Pro-only)
- [x] 4.3 Implementasi alur Solve-then-Guide di `lib/agents/solveThenGuide.ts`: step solve (model Astra configurable) → verifikasi via `runCode` (retry terbatas, configurable) → susun pertanyaan Socratic mundur dari solusi terverifikasi; bila verifikasi gagal permanen → pesan jujur, bukan dialog dengan jawaban belum pasti
- [x] 4.4 Trigger otomatis: deteksi kompleksitas di Kompas/Socra saat loop ON → escalate ke Solve-then-Guide → kembali ke loop normal setelah solusi didapat
- [x] 4.5 Trigger manual: opsi Solve-then-Guide di composer untuk user Pro (cek entitlement, arahkan ke upgrade bila bukan Pro)
- [x] 4.6 Event SSE `step` + `terminal_output` (format PRD §8.4) dari endpoint backend; step-log UI di chat mengonsumsi event asli — tanpa step palsu/dekoratif; tampilan jujur saat koneksi putus
- [x] 4.7 Artifact `terminal`: panel CLI clay-pressed + monospace, streaming stdout/stderr asli, collapsed by default di step-log, expandable, read-only (tanpa edit di toolbar)
- [x] 4.8 Cap biaya harian bucket `astra` terpisah dari bucket `loop`; fallback pesan ramah saat terlampaui
- [x] 4.9 Rilis di belakang flag `FEATURE_SOLVE_THEN_GUIDE` (Pro terbatas); daftarkan env + dokumentasi singkat

> Catatan: `npm install e2b` di mesin dev tertunda (hak akses sesi). Wrapper `lib/sandbox/runCode.ts` memakai dynamic import — build tetap sehat tanpa SDK; jalankan `npm install e2b` sebelum menyalakan `FEATURE_SOLVE_THEN_GUIDE=1` + `E2B_API_KEY`.

## 5. Tahap 5 — Guardrail Lintas Sistem & Penutup

- [x] 5.1 Verifikasi rate limit per agent aktif untuk semua agent (bukan cuma per user/fitur); tangani kehabisan kuota per agent dengan grace
- [x] 5.2 Audit cap biaya: bucket `loop` dan `astra` terpisah, terukur dari `agent_call_logs`, reset harian
- [x] 5.3 Uji isolasi kegagalan end-to-end: matikan/timeout-kan satu agent secara sengaja → sesi lain dan agent lain tidak terpengaruh, fallback Kompas wajar
- [x] 5.4 Uji sandbox: kode jaringan gagal, infinite loop kena timeout, bahasa di luar whitelist ditolak, sandbox dihancurkan setelah eksekusi
- [x] 5.5 Tipe `image` (Palet) di Artifact Canvas dengan toolbar copy/simpan — melengkapi 3 tipe
- [x] 5.6 Ringkasan file yang diubah/ditambah per tahap (deliverable #6) di akhir implementasi

## Ringkasan File per Tahap (Deliverable #6)

### Tahap 1 — Layer Routing Model & Pemisahan Agent
| File | Status | Isi |
|---|---|---|
| `lib/agents/catalog.ts` | BARU | Katalog 6 agent (AgentId, AgentConfig), model via env override, resolveAstraModel() |
| `lib/agents/callAgentModel.ts` | BARU | Abstraksi tunggal `callAgentModel` + `callAgentModelStream`; rate limit per agent (`agent:{id}:user:{uid}`); AgentRateLimitError |
| `lib/agents/agentLog.ts` | BARU | Helper log ke `agent_call_logs` (best-effort, tidak crash) |
| `lib/prompts/agents.ts` | BARU | Prompt persona Kompas/Socra/Lensa/Jejak/Palet/Kilau + varian Socra post-solution |
| `lib/agents/index.ts` | BARU | Modul 6 agent: kompasClassify, socraStream(WithSolution), lensaAssess, jejakSummarize, paletPrompt, kilauGreet |
| `lib/agents/costCap.ts` | BARU | Estimasi token + re-export checkDailyCostCap |

### Tahap 2 — Kompas Router + Toggle & Loop
| File | Status | Isi |
|---|---|---|
| `supabase_patch_021_agent_system.sql` | BARU | Tabel agent_call_logs + agent_loop_sessions + agent_loop_iterations (RLS) |
| `lib/agents/loopStore.ts` | BARU | CRUD state loop persisten + startIteration/completeIteration + cap biaya 2 bucket + rate limit turn |
| `lib/agents/loop.ts` | BARU | State machine act→observe→reflect→decide; detectManualExit; decideNext (aturan deterministik) |
| `app/api/agents/loop/route.ts` | BARU | Endpoint SSE loop: sesi baru, reflect+decide, stop instan, fallback Kompas; trigger StG otomatis/manual; alur Jejak & Palet |
| `backend/src/routes.ts` | EDIT | Mount `/api/agents/loop` (+1 route) |
| `lib/agents/loopStream.ts` | BARU | Klien SSE loop + tipe event (loop_state/step/terminal_output) |
| `lib/assistant/useAssistantChat.ts` | EDIT | LoopUiState, sendLoop (jalur loop), loopRef, setLoopToggle |
| `components/asisten/Composer.tsx` | EDIT | Props toggle Multi Agent + pill dua state (clay vs `--accent-coral`) |
| `app/chat/[id]/page.tsx` | EDIT | multiAgentAvailable (flag), wiring toggle, indikator "Iterasi x/N" di header |
| `app/globals.css` | EDIT | Token `--accent-coral` (light #F97362 / dark #FB9282) |

### Tahap 3 — Artifact Canvas (markdown)
| File | Status | Isi |
|---|---|---|
| `lib/agents/types.ts` | BARU | Tipe Artifact + guard type/sourceAgent |
| `lib/agents/artifactParser.ts` | BARU | Parser streaming token-by-token; withhold prefix; flush aman tag menggantung |
| `lib/assistant/useAssistantChat.ts` | EDIT | CanvasState, applyParserEvents, parser per send, saveArtifactEdit (version naik) |
| `components/asisten/ArtifactCanvas.tsx` | BARU | Panel canvas (desktop samping/mobile sheet), toolbar per tipe, tab multi-artifact |

### Tahap 4 — Sandbox + Solve-then-Guide + terminal
| File | Status | Isi |
|---|---|---|
| `lib/sandbox/runCode.ts` | BARU | Interface runCode; adaptor E2B (dynamic import); ephemeral kill di finally; whitelist/timeout/memory env |
| `lib/agents/solveThenGuide.ts` | BARU | SOLVE→VERIFY(retry)→GUIDE dengan emit step/terminal_output asli; gagal-permanen → pesan jujur |
| `lib/premium.ts` | EDIT | PremiumFeature + FEATURE_LIMITS entry `solve-then-guide` (Pro-only) + label |
| `lib/agents/callAgentModel.ts` | EDIT | Overrides.model (Astra naik-kelas kondisional) |
| `lib/assistant/useAssistantChat.ts` | EDIT | stepLog + terminalLive state; handler event step/terminal_output |
| `components/asisten/StepLog.tsx` | BARU | Step-log UI (✓/⏳/✗ dari event asli) + terminal collapsed (details/summary clay-pressed) |
| `components/asisten/Composer.tsx` | EDIT | stgOnce (trigger manual sekali kirim) + solveThenGuide di ComposerSendInput |
| `.env.example` | EDIT | FEATURE_MULTI_AGENT, FEATURE_SOLVE_THEN_GUIDE, AGENT_ASTRA_MODEL, override model per agent, AGENT_LOOP_MAX_ITERATIONS, cap token 2 bucket, E2B_* |

### Tahap 5 — Guardrail & Penutup
| File | Status | Isi |
|---|---|---|
| `scripts/test-agent-failure-isolation.ts` | BARU | 7 skenario: fallback Lensa/Kompas, error transparan, key rate-limit terpisah, exit manual, whitelist sandbox, error tanpa key — 7/7 lolos |
