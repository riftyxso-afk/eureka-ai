## Context

Saat ini `lib/rag/extract.ts:scrapeYoutubeTranscript` hanya coba `lang: "id"` lalu default, padahal 3 video uji Shorts (`umKki_RdSO8`, `RaXQhSRh2jQ`, `Tmmok63hVj0`, `PpL6wTL5Mrs`) tidak punya track manual dan auto-caption HP tidak terekspos via `youtube-transcript`. Fallback `ytdl-core` broken (`Could not extract functions` / `Failed to find any playable formats`) karena YouTube ubah signature, dan `backend/src/server.ts` sudah load `.env.local` root tapi `lib/apiClient.ts` default `http://localhost:3001` bikin `ERR_CONNECTION_REFUSED` kalau backend mati. `lib/ai.ts:getProviderChain` sebelumnya mencampur Juan (`SPEED_MODEL_LISTS` lama dengan 17 model OFF 403/503) dengan OpenAgentic/OpenRouter dalam satu rantai, sehingga `nvidia/nemotron-3.5-lightning:free` yang gagal JSON memblokir fallback ke `deepseek-v4-flash-free` yang OK. `app/api/notes/process/route.ts` melempar `updateJob({error: "Terjadi kesalahan..."})` generik dan rate limit 3/jam terlalu rendah untuk testing. Lihat `proposal.md - Why`.

## Goals / Non-Goals

**Goals:**
- Buat `POST /api/notes/process` berhasil untuk YouTube dengan/ tanpa subtitle via Whisper fallback yang reliable.
- Pisah rantai provider chat vs notes agar tidak saling blokir dan JSON notes reliable.
- Tampilkan error spesifik per sumber + kode 429/401/503 di UI dan `backend.log`.
- Dokumentasikan `NEXT_PUBLIC_API_URL` dan rate limit baru.

**Non-Goals:**
- Tidak menambah UI baru untuk upload YouTube audio manual (cukup fallback otomatis).
- Tidak migrasi database atau ubah skema `notes`/`jobs`.
- Tidak ganti provider Whisper selain `whisper-1` via OpenAgentic (sudah ada).

## Decisions

**1. Multi-lang transcript + Whisper fallback di `extract.ts`**
- **Keputusan**: Loop `["id","en","en-US",undefined]` via `youtube-transcript`, bersihkan `YT_SOUND_CUE_RE`, jika tetap kosong dan `isOpenAICompatible()` true → `downloadYoutubeAudio` via `@distube/ytdl-core` (fallback ke `ytdl-core`) → `transcribeAudioVideo` (`whisper-1`).
- **Alternatif**: Langsung download audio tanpa coba transcript (boros token) atau pakai `yt-dlp` binary (lebih tahan tapi butuh instalasi binary + `yt-dlp-exec`). Dipilih ytdl dulu karena sudah ada deps, yt-dlp sebagai opsi jika masih `Failed to find formats`.
- **Rationale**: 4 video uji semua tanpa `id` track; HP auto-caption tidak terekspos, Whisper satu-satunya jalan untuk Shorts.

**2. Split `getProviderChain(speedMode, forChat)`**
- **Keputusan**: Tambah `forChat?: boolean` di `AiChatOptions`, `getProviderChain(..., forChat)` branch: `forChat=true` → Juan only (`SPEED_MODEL_LISTS` baru Kilat `gemini-3.7-flash-low` ✓, Seimbang 5 ON, Mendalam `gpt-5.6-terra/luna` ✓ di depan), `forChat=false` → OpenAgentic `["deepseek-v4-flash-free","hy3-free"]` + OpenRouter `[...OPENROUTER_FREE_MODELS]` (urut ON duluan, `nvidia`/`poolside` ✓). Urutan OpenAgentic dulu karena `nvidia` gagal JSON (`thinking` bukan JSON) dan `liquid`/`z-ai` 429.
- **Alternatif**: Satu rantai panjang Juan→OpenAgentic→OpenRouter (lama) — gagal karena `nvidia` blokir fallback. Dipisah agar chat tetap pakai model terpintar Juan, notes pakai JSON-reliable free.
- **Rationale**: Test JSON 2026-08-27: OpenAgentic `deepseek-v4-flash-free`/`hy3-free` 200 JSON OK, OpenRouter `poolside` OK tapi `nvidia`/`liquid`/`z-ai` 429/gagal JSON, Juan `gemini-3.7-flash-low`/`deepseek-v4-pro`/`gpt-5.6-terra` ON.

**3. Error visibility & rate limit**
- **Keputusan**: `app/api/notes/process/route.ts` catch simpan `${baseMsg} Detail: ${detail}` (1200 char) di `updateJob` + `tracker.emit`, `CreateNoteModal` tampilkan `Kode error: 429/401/503` + `Detail`. Rate limit naik 3→10/jam, `Retry-After` header tetap.
- **Alternatif**: Tetap 3/jam dengan dashboard admin reset — tidak ramah testing. Dipilih naik + reset via restart (in-memory) sudah cukup.

**4. Backend env & apiClient**
- **Keputusan**: `backend/src/server.ts` sudah load `root/.env.local` (`override:false`), tidak perlu `backend/.env`. `lib/apiClient.ts` tetap default `http://localhost:3001` di localhost, tapi dokumentasikan opsi `NEXT_PUBLIC_API_URL=http://localhost:3000` untuk same-origin (tanpa backend terpisah).
- **Rationale**: User `ERR_CONNECTION_REFUSED` karena backend mati; health `GET /api/health 200` membuktikan setelah `cd backend && npm run dev` koneksi OK.

## Risks / Trade-offs

- **ytdl-core masih broken untuk Shorts** (`Could not extract functions`, `Failed to find any playable formats`) → Mitigasi: fallback log `Whisper fallback gagal: ...` dan lempar error asli yang jelas; opsi next adalah `yt-dlp-exec` (+binary) jika Shorts tetap gagal.
- **Whisper butuh `OPENAGENTIC_API_KEY` dan kuota** → Mitigasi: cek `isOpenAICompatible()` dulu; jika false, langsung error "pakai Dokumen/Web" tanpa coba download.
- **Download audio Shorts bisa besar/timeout 30s** → Mitigasi: timeout 30s, cek `>25MB` tolak, pesan "coba video lebih pendek".
- **Split provider bikin `hasAiKey` harus cek dua rantai** → Mitigasi: `hasAiKey = getProviderChain(true).length>0 || getProviderChain(false).length>0`.
- **Rate limit in-memory reset saat restart** → Mitigasi: dokumentasikan, tidak persist ke DB (cukup untuk dev).

## Migration Plan

1. Deploy `lib/rag/extract.ts`, `lib/ai.ts`, `app/api/notes/process/route.ts`, `app/api/assistant/chat/route.ts`, `lib/apiClient.ts` (no DB migration).
2. `npm install @distube/ytdl-core` (sudah), `npx tsc --noEmit` harus 0.
3. Restart `backend` (`npm run dev` di `backend/`) dan Next.js (`npm run dev`).
4. Test: `POST /api/notes/process` dengan 1 YouTube Shorts tanpa CC → harus fallback Whisper atau error spesifik dengan `Kode error`; `POST /api/assistant/chat` dengan `forChat=true` → harus pakai Juan; `GET /api/health` 200.
5. Rollback: revert 4 file + `npm uninstall @distube/ytdl-core` bila ytdl masih gagal luas, kembali ke error "Coba video lain".

## Open Questions

- Apakah `yt-dlp` (binary) perlu dibundling untuk Shorts yang tetap `Failed to find formats`? — Ditunda, lihat apakah `@distube/ytdl-core` cukup setelah update YouTube; jika masih 100% Shorts gagal, follow-up change `youtube-yt-dlp-fallback`.
- Apakah rate limit 10/jam perlu dipersist ke Supabase untuk multi-instance? — Ditunda, in-memory cukup untuk single backend dev.
