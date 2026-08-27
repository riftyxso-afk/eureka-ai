## Why

Pengguna tidak bisa membuat catatan dari YouTube — 3 video uji (`umKki_RdSO8`, `RaXQhSRh2jQ`, `Tmmok63hVj0`, `PpL6wTL5Mrs`) semua gagal dengan pesan generik "Terjadi kesalahan saat memproses materi" dan `429 Too Many Requests` setelah 3 percobaan. Audit live 2026-08-27 menemukan 5 kegagalan berlapis yang saling menutupi: transcript YouTube tidak tersedia untuk Shorts/musik (HP ada auto-caption tapi API tidak), fallback `ytdl-core` broken (`Could not extract functions` / `Failed to find any playable formats`), rate limit 3/jam terlalu rendah untuk testing, error detail disembunyikan (hanya `updateJob({error: "Terjadi..."})`), rantai provider tercampur (chat=Juan, notes=OpenAgentic/OpenRouter saling blokir di `getProviderChain`), dan backend `localhost:3001` mati (`ERR_CONNECTION_REFUSED`) karena `NEXT_PUBLIC_API_URL` default.

## What Changes

- **Perbaiki ekstraksi YouTube transcript**: coba multi-bahasa `id`→`en`→`en-US`→default, hapus marker suara `[Musik]`, dan tambah fallback transkripsi audio via Whisper (`@distube/ytdl-core` → `transcribeAudioVideo`) ketika subtitle tidak ada; tangani Shorts dan auto-caption HP vs PC.
- **Pisah rantai provider**: `forChat=true` → Juan Router only (`SPEED_MODEL_LISTS` Kilat/Seimbang/Mendalam yang sudah difilter ON + `claude-opus-5`/`gpt-5.6-terra` dll), `forChat=false` → OpenAgentic (`deepseek-v4-flash-free`, `hy3-free` ✓) + OpenRouter (`:free` only, `nvidia`/`poolside` ✓) dengan urutan JSON-reliable (OpenAgentic dulu, baru OpenRouter yang `nvidia` gagal JSON).
- **Rate limit & error visibility**: naikkan `note-process` dari 3/jam → 10/jam untuk dev, tampilkan `Detail: ...` di `updateJob`/`tracker.emit` dan di popup `Kode error: 429/401/503`, serta perbaiki `backend.log` agar tidak generik.
- **Backend env & koneksi**: pastikan `backend/src/server.ts` load `.env.local` root (`override:false`), dokumentasikan `NEXT_PUBLIC_API_URL=http://localhost:3000` untuk same-origin vs `http://localhost:3001` untuk backend terpisah, dan perbaiki `ytdl-core` → `@distube/ytdl-core` (plus opsi `yt-dlp` bila masih `Failed to find formats`).
- **Model aktif**: filter OFF → `OPENAGENTIC_FREE_MODELS`, `OPENROUTER_FREE_MODELS` (`:free` only), `SPEED_MODEL_LISTS` baru (Kilat `gemini-3.7-flash-low` ✓, Seimbang 5 ON, Mendalam `gpt-5.6-terra/luna` ✓ di depan).

## Capabilities

### New Capabilities
- (none) — audit ini memperbaiki perilaku existing, bukan menambah domain baru.

### Modified Capabilities
- `notes`: REQUIREMENTS berubah — ekstraksi YouTube wajib fallback Whisper, rate limit, provider split untuk buat catatan, dan error spesifik per sumber.
- `youtube-video-chat`: REQUIREMENTS berubah — transcript harus coba multi-lang dan fallback audio, serta pesan error bedakan HP auto-caption vs PC scraper.

## Impact

- **Code**: `lib/rag/extract.ts` (scrape + download audio + Whisper), `lib/ai.ts` (`SPEED_MODEL_LISTS`, `OPENAGENTIC_FREE_MODELS`, `getProviderChain(forChat)`), `lib/notesProcessor.ts`/`lib/jobQueue.ts`, `app/api/notes/process/route.ts` (rate limit + error Detail), `backend/src/server.ts` (env load), `lib/apiClient.ts` (fallback URL), `components/dashboard/CreateNoteModal.tsx` (popup `Kode error`).
- **APIs**: `POST /api/notes/process` (429 handling), `GET /api/notes/jobs/:id` (error detail), `POST /api/assistant/chat` (`forChat`).
- **Dependencies**: `@distube/ytdl-core` mengganti `ytdl-core` (broken), `youtube-transcript`, Whisper `whisper-1` via OpenAgentic.
- **Ops**: Backend `http://localhost:3001` harus jalan atau set `NEXT_PUBLIC_API_URL=http://localhost:3000`; rate limit in-memory reset saat restart.
