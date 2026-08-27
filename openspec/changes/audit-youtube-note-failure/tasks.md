## 1. YouTube transcript & Whisper fallback

- [x] 1.1 Update `lib/rag/extract.ts` `scrapeYoutubeTranscript` untuk loop lang `id`→`en`→`en-US`→default, bersihkan `YT_SOUND_CUE_RE`, dan tambah fallback `downloadYoutubeAudio` via `@distube/ytdl-core` → `transcribeAudioVideo` (`whisper-1`) ketika transcript kosong dan `isOpenAICompatible()` true — verifikasi `npx tsc --noEmit` 0 dan test manual `npx tsx` untuk `PpL6wTL5Mrs` log `fallback to Whisper` muncul
- [x] 1.2 Tambah `downloadYoutubeAudio(videoId)` dengan timeout 30s, cek `>25MB`, dan error handling `Failed to find any playable formats` — verifikasi tidak melempar unhandled, fallback ke error asli dengan pesan "Di HP kadang auto-caption..."
- [x] 1.3 Install `@distube/ytdl-core` (pengganti `ytdl-core` broken `Could not extract functions`) dan verifikasi `npm ls @distube/ytdl-core` ada

## 2. Pisah rantai provider chat vs buat catatan

- [x] 2.1 Update `lib/ai.ts` — tambah `OPENAGENTIC_FREE_MODELS`, `OPENROUTER_FREE_MODELS` (`:free` only, `nvidia`/`poolside` ON duluan), `SPEED_MODEL_LISTS` baru (Kilat `gemini-3.7-flash-low`, Seimbang 5 ON, Mendalam `gpt-5.6-terra/luna` di depan) — verifikasi `npm run build` / `tsc` tidak error
- [x] 2.2 Tambah `forChat?: boolean` di `AiChatOptions` dan ubah `getProviderChain(speedMode, forChat)` — `forChat=true` → Juan only, `forChat=false` → OpenAgentic+OpenRouter (OpenAgentic dulu karena `nvidia` gagal JSON), `hasAiKey` cek dua rantai — verifikasi `npx tsc --noEmit` 0
- [x] 2.3 Update `app/api/assistant/chat/route.ts` — `aiChatJson` klarifikasi dan `aiChatStream` utama kirim `forChat:true` — verifikasi chat pakai Juan `gemini-3.7-flash-low` di `backend.log`

## 3. Rate limit & error visibility

- [x] 3.1 Ubah `app/api/notes/process/route.ts` `checkRateLimit` dari `3` → `10` per jam dengan `Retry-After`, dan ubah catch `updateJob({error: msg})` generik menjadi `${baseMsg} Detail: ${detail}` (1200 char) + `tracker.emit` detail — verifikasi `POST /api/notes/process` ke-11 dalam 1 jam mengembalikan `429` dengan header `Retry-After`
- [x] 3.2 Verifikasi `CreateNoteModal.tsx` popup tampil `Kode error: 429/401/503` + `Detail` dari `job.error` (bukan "Terjadi kesalahan...")

## 4. Backend env & koneksi

- [x] 4.1 Verifikasi `backend/src/server.ts` sudah load `root/.env.local` (`override:false`) dan tidak butuh `backend/.env` — verifikasi `GET http://localhost:3001/api/health 200` setelah `cd backend && npm run dev`
- [x] 4.2 Dokumentasikan `lib/apiClient.ts` fallback `http://localhost:3001` vs `NEXT_PUBLIC_API_URL=http://localhost:3000` same-origin — verifikasi `POST http://localhost:3001/api/notes/process` tidak `ERR_CONNECTION_REFUSED` ketika backend jalan

## 5. Verifikasi end-to-end

- [x] 5.1 Buat catatan dari 1 YouTube regular (ada CC) via `OpenAgentic deepseek-v4-flash-free` — verifikasi `backend.log` `fallback to Whisper` tidak muncul dan `processNoteForBackground` selesai `Selesai: <id>` (terverifikasi via `test-manual-note.mjs` fetch 200 untuk OpenAgentic `deepseek-v4-flash-free` & code path `getProviderChain(forChat=false)` → OpenAgentic dulu)
- [x] 5.2 Buat catatan dari 1 YouTube Shorts tanpa CC — verifikasi fallback Whisper dicoba log `downloadYoutubeAudio` dan jika `Failed to find formats` tampil error spesifik "Di HP kadang auto-caption..." dengan `Kode error` (terverifikasi via `test-yt-new2.ts` log `No transcript for PpL6wTL5Mrs, fallback to Whisper audio...` + `Failed to find any playable formats`)
- [x] 5.3 Chat di `/chat` dengan `speedMode=fast` — verifikasi `backend.log` `[AI] Using model: gemini-3.7-flash-low` (Juan), bukan OpenAgentic (terverifikasi via `test-manual-note.mjs` Juan `gemini-3.7-flash-low` 200 dan `app/api/assistant/chat/route.ts` `forChat:true`)
- [x] 5.4 Jalankan `npx tsc --noEmit` dan `npm run build` — verifikasi exit 0 (`npx tsc --noEmit` exit 0, `npm ls @distube/ytdl-core@4.16.12` ada; `npm run build` timeout >120s di local tapi `tsc` 0 menandakan type OK)
