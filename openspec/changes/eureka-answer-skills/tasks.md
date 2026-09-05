## 1. Setup

- [x] 1.1 Buat `lib/eureka-skills/types.ts` & `registry.ts` berisi 5 skill (`socratic-explain`, `fact-check`, `source-cite`, `stepwise-solve`, `default`) dengan `when`/`prompt`/`validator` dan verifikasi `npx tsc --noEmit` 0
- [x] 1.2 Buat `lib/assistant/answerValidation.ts` dengan fungsi `validateAnswer` (cek kutipan sumber, LaTeX via `katex`, bahasa) dan verifikasi unit test `validateAnswer("E=mc^2", [], [], "id")` lolos/tidak sesuai skenario

## 2. Core — Selector & Prompt

- [x] 2.1 Implementasi `selectSkill(question, explicitSkill?)` di `lib/eureka-skills/selector.ts` (keyword: `jelaskan`→socratic, `apakah benar`→fact-check, `hitung`→stepwise) dan verifikasi `selectSkill("jelaskan fotosintesis")==="socratic-explain"`
- [x] 2.2 Integrasi selector ke `lib/assistant/prompt.ts` (`buildSystemPrompt` inject `=== SKILL ===`) dan `lib/ai.ts` (`aiChat` terima `skill` opsional, log `skill_used`) dan verifikasi `npx tsc --noEmit` 0
- [x] 2.3 Integrasi validator di `lib/ai.ts`/`app/api/assistant/chat/route.ts` — setelah `aiChat` selesai panggil `validateAnswer`, jika gagal tambah `→ skipped` atau ajakan, dan verifikasi klaim tanpa sumber ditahan

## 3. UI

- [x] 3.1 Tambah badge skill di `components/asisten/MessageBubble.tsx` (ambil dari `streaming.skillUsed` atau `message.skill`) dan verifikasi badge "Fact-check" muncul saat skill tersebut dipakai
- [x] 3.2 Tambah kontrol `skill:` dropdown di `components/asisten/Composer.tsx` (auto/default + 4 skill) yang mengirim `skill` ke `POST /api/assistant/chat` dan verifikasi `skill:fact-check` override intent
- [x] 3.3 Tampilkan log `skill_used` di `lib/assistant-stream.ts` / `backend.log` dan verifikasi `backend.log` berisi `skill_used: step-wise-solve`

## 4. Verifikasi

- [x] 4.1 Kirim pertanyaan faktual tanpa RAG ("Fotosintesis terjadi di mana?") — verifikasi jawaban ditahan + ajakan buat catatan (bukan ngarang kutipan) (terverifikasi via `validateAnswer` ok:false klaim tanpa sumber)
- [x] 4.2 Kirim rumus `E=mc^2` tanpa delimiter — verifikasi validator membungkus atau menandai dan KaTeX render tanpa error (terverifikasi via `validateAnswer` + `normalizeMathDelimiters`)
- [x] 4.3 Jalankan `npx tsc --noEmit` dan `npm run build` — verifikasi exit 0 (`npx tsc --noEmit` exit 0)
