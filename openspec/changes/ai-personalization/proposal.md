## Why

Eureka.AI saat ini menjawab dengan gaya seragam untuk semua pengguna tanpa memperhatikan preferensi belajar individu (tingkat kesulitan, gaya bahasa, kecepatan respons, depth penjelasan). Pengguna tidak bisa menyesuaikan gaya AI sesuai kebutuhan belajar mereka (mis. siswa SD butuh penjelasan sederhana, mahasiswa butuh depth teknis, user ADHD butuh ringkas/terstruktur). Personalisasi akan meningkatkan engagement & efektivitas belajar.

## What Changes

- Tambah model `UserAIPreferences` (tingkat kesulitan, gaya bahasa, panjang jawaban, kecepatan, Socratic level, mode fokus, bahasa preferensi)
- UI halaman `/dashboard/pengaturan/ai` untuk set preferensi (slider, dropdown, toggle)
- Inject `userPreferences` ke `buildSystemPrompt` → modifikasi system prompt dinamis
- Middleware validasi preferensi di `aiChat`/`aiChatStream` sebelum call LLM
- API `GET/PATCH /api/user/ai-preferences` (CRUD preferensi)
- Migrasi data lama → default preferences
- UI badge indikator personalisasi aktif di Composer/MessageBubble

## Capabilities

### New Capabilities
- `user-ai-preferences`: CRUD preferensi AI per user (tingkat kesulitan, gaya bahasa, panjang jawaban, kecepatan, Socratic level, focus mode, bahasa)
- `ai-personalization-engine`: Engine inject preferensi ke system prompt dinamis + validasi preferensi

### Modified Capabilities
- `assistant-chat`: Inject preferensi user ke system prompt + validasi response sesuai preferensi
- `note-generation`: Generate catatan sesuai tingkat kesulitan & gaya bahasa user

## Impact

- **Code**: `lib/ai.ts`, `lib/assistant/prompt.ts`, `lib/userPreferences.ts`, `app/api/user/ai-preferences/route.ts`, `components/dashboard/AIPreferences.tsx`, `components/asisten/Composer.tsx`, `lib/assistant/prompt.ts`
- **DB**: Tabel baru `user_ai_preferences` (FK ke `users`, JSON `preferences`, timestamps)
- **API**: `GET/PATCH /api/user/ai-preferences`
- **Dependencies**: Reuse `zod` untuk validasi schema preferensi
- **Migrasi**: Script seed default preferences untuk user existing