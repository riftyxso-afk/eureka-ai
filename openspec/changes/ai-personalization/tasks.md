## 1. Database & Schema

- [ ] 1.1 Buat migration Supabase untuk tabel `user_ai_preferences` (FK `user_id`, JSONB `preferences`, `created_at`, `updated_at`) + index pada `user_id` — verifikasi `supabase migration up` success
- [ ] 1.2 Buat `lib/userPreferences.ts` berisi `DEFAULT_AI_PREFERENCES`, Zod schema `AI_PREFERENCES_SCHEMA`, fungsi `getDefaultPreferences()`, `validatePreferences()`, `mergePreferences()` — verifikasi `npx tsc --noEmit` 0
- [ ] 1.3 Buat `lib/userPreferencesServer.ts` (server-only) dengan `getUserPreferences(userId)`, `updateUserPreferences(userId, partialPrefs)`, `resetUserPreferences(userId)` — verifikasi `npx tsc --noEmit` 0

## 2. API Endpoints

- [ ] 2.1 Buat `app/api/user/ai-preferences/route.ts` (GET, PATCH, DELETE) dengan auth check, validasi Zod, error handling — verifikasi `curl GET/PATCH/DELETE` manual 200/400/403/404 sesuai kasus
- [ ] 2.2 Tambah middleware validasi body PATCH via Zod schema — verifikasi input invalid return 400 dengan detail field

## 3. Personalization Engine

- [ ] 3.1 Update `lib/assistant/prompt.ts` `buildSystemPrompt` terima param `userPreferences` dan inject section `=== USER PREFERENCES ===` — verifikasi prompt mengandung section saat `userPreferences` disediakan
- [ ] 3.2 Tambah helper `formatPreferences(prefs)` di `lib/assistant/prompt.ts` yang generate instruksi per field (difficulty, length, socratic, dll) — verifikasi output prompt mengandung instruksi yang benar
- [ ] 3.3 Update `lib/ai.ts` `aiChat`/`aiChatStream` terima param `userPreferences` dan passing ke `buildSystemPrompt` — verifikasi log `[AI] Using preferences` di console

## 4. Answer Validation

- [ ] 4.1 Buat `lib/assistant/answerValidation.ts` dengan `validateAnswer(answer, prefs, ragHits, webResults)` — cek panjang, bahasa, Socratic level — verifikasi unit test `validateAnswer("E=mc^2", prefsShort, [], [])` return `{ok: false, fixed: "E=mc^2..."}`
- [ ] 4.2 Integrasi validator ke `app/api/assistant/chat/route.ts` setelah `aiChatStream` selesai, sebelum `emit done` — verifikasi jawaban faktual tanpa sumber ditambahkan ajakan, jawaban panjang di-truncate, bahasa non-id di-translate

## 3. API & DB

- [ ] 3.1 Migrasi Supabase: `supabase migration new create_user_ai_preferences` — verifikasi `supabase db push` success
- [ ] 3.2 Seed default preferences untuk user existing via script `scripts/seed-ai-preferences.ts` — verifikasi `npx tsx scripts/seed-ai-preferences.ts` success

## 4. UI Settings

- [ ] 4.1 Buat `components/dashboard/AIPreferences.tsx` form lengkap (Select difficulty, responseLength, speed, socraticLevel slider, focusMode toggle, language select) — verifikasi render di `/dashboard/pengaturan/ai`
- [ ] 4.2 Integrasi ke `/dashboard/pengaturan/page.tsx` tab "AI" — verifikasi nav tab "AI" muncul & form functional
- [ ] 4.3 Hook `useAIPreferences()` di `hooks/useAIPreferences.ts` (fetch, mutate via `apiFetch` PATCH) — verifikasi SWR cache update setelah save
- [ ] 4.4 Badge indikator personalisasi aktif di `Composer` & `MessageBubble` — verifikasi badge "Personalized" muncul saat preferensi non-default

## 5. Integration & Validation

- [ ] 5.1 Hook validator ke `app/api/assistant/chat/route.ts` setelah `aiChatStream` selesai — verifikasi `backend.log` berisi `[AI] validation: truncated/translated/adjusted`
- [ ] 5.2 Inject `userPreferences` ke `aiChatStream` call di `app/api/assistant/chat/route.ts` — verifikasi `backend.log` berisi `Using preferences: {...}`
- [ ] 5.3 Test end-to-end: set `difficulty: easy` + `responseLength: short` → kirim pertanyaan kompleks → verifikasi jawaban singkat & bahasa sederhana

## 5. Migration & Deploy

- [ ] 5.1 Script seed default preferences: `scripts/seed-ai-preferences.ts` untuk user existing — verifikasi `npx tsx scripts/seed-ai-preferences.ts` inserted N rows
- [ ] 5.2 Update `.env.example` dokumentasi variabel baru (jika ada) — verifikasi file updated
- [ ] 5.3 `npx tsc --noEmit` dan `npm run build` — verifikasi exit 0
- [ ] 5.4 Deploy staging → test end-to-end production → promote ke production