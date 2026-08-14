## Why

Halaman `/chat` sudah bisa membuat catatan, tapi belum bisa langsung menguji pemahaman dari percakapan: user harus pindah ke halaman note untuk membuat kuis/flashcard. Selain itu tidak ada umpan balik performa dari user setelah mereka membuat catatan, sehingga tim tidak tahu kualitas Eureka dari sudut pandang pengguna.

## What Changes

- **Kuis di chat (`/kuis`)**: mengetik `/kuis` di composer membuka popup kuis interaktif (pilihan ganda + pembahasan) yang di-generate AI dari seluruh topik percakapan sesi aktif + materi catatan yang di-mention (`@`) di sesi itu. Pola UI & interaksi mengikuti `QuizModal` yang sudah ada (kuis note), termasuk reward XP.
- **Flashcard di chat (`/card`)**: mengetik `/card` membuka popup flashcard interaktif (balik kartu, navigasi) yang di-generate AI dari sumber materi yang sama. Pola UI mengikuti `FlashcardModal` yang sudah ada, termasuk reward XP.
- **Survey performa Eureka**: 1 menit setelah catatan PERTAMA user berhasil dibuat, muncul survey sekali seumur hidup per user (tidak spam): rating performa Eureka + saran. Jawaban disimpan ke tabel Supabase baru `note_feedback`.
- **Mobile-friendly**: semua fitur baru dirancang mobile-first (popup bottom-sheet, touch target ≥44px, aman untuk safe-area) mengikuti pola modal yang sudah ada.
- Tidak ada perubahan perilaku fitur yang sudah ada; semua penambahan bersifat additive.

## Capabilities

### New Capabilities
- `chat-quiz`: Kemampuan membuat & mengerjakan kuis interaktif langsung dari halaman chat via command `/kuis`, dengan materi dari isi percakapan sesi dan catatan yang di-mention.
- `chat-flashcards`: Kemampuan membuat & melatih flashcard langsung dari halaman chat via command `/card`, dengan materi dari isi percakapan sesi dan catatan yang di-mention.
- `note-feedback`: Kemampuan mengumpulkan survey performa Eureka sekali per user setelah catatan pertama berhasil dibuat, dan menyimpannya ke database.

### Modified Capabilities
- Tidak ada. (`chat-share` yang sudah diarsip tidak berubah.)

## Impact

- **Frontend**:
  - `components/asisten/Composer.tsx` — deteksi command `/kuis` & `/card` saat submit.
  - `app/chat/[id]/page.tsx` — integrasi popup kuis & flashcard (state + render).
  - Baru: `components/asisten/ChatQuizModal.tsx` & `ChatFlashcardModal.tsx` (atau reuse `QuizModal`/`FlashcardModal` yang di-generalize), `FeedbackSurveyModal.tsx`.
  - `components/note/NoteProgressOverlay.tsx` — sinyal "catatan pertama selesai" → jadwalkan survey (delay 1 menit, sekali per user).
- **API** (app Next.js, di-mount juga di `backend/src/routes.ts`):
  - Baru: `app/api/assistant/quiz/route.ts` (POST) — generate kuis dari sesi + mentions.
  - Baru: `app/api/assistant/flashcards/route.ts` (POST) — generate flashcard dari sesi + mentions.
  - Baru: `app/api/feedback/note/route.ts` (POST) — simpan survey; GET (opsional) — cek sudah survey/belum.
- **Data**: Supabase — tabel baru `note_feedback` (user_id, rating, saran, created_at) dengan RLS owner; patch SQL baru `supabase_patch_005_note_feedback.sql`.
- **Lib**: `lib/studyTools.ts` — `generateQuiz`/`generateFlashcards` dipakai ulang (atau varian untuk input pesan + konten note); util baru untuk menggabungkan konteks sesi + catatan mention.
- **XP**: `lib/levelUp.ts` (`postProgress`) — reward XP kuis/card dari chat (pola sama seperti kuis/card note).
- **Keamanan**: semua route baru memakai `authorizeAssistantUser` (kepemilikan sesi diverifikasi); survey hanya sekali per user (dicek server-side).