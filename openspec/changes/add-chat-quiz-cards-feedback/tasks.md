## 1. Database & Material Layer

- [x] 1.1 Buat `supabase_patch_005_note_feedback.sql`: tabel `note_feedback` (id, user_id NOT NULL UNIQUE, rating SMALLINT NULL CHECK 1-5, suggestion TEXT NULL, dismissed BOOLEAN NOT NULL DEFAULT false, created_at timestamptz default now()) + RLS owner-only (select/insert) + index user_id
- [x] 1.2 Buat `lib/assistant/studyContext.ts`: fungsi membangun konteks dari pesan sesi (role + content, potong ~20k karakter) + konten catatan mention (levati catatan tanpa bab/hilang; title-only jika tak ada konten)
- [x] 1.3 Tambah `generateQuizFromContext(context, count)` dan `generateFlashcardsFromContext(context)` di `lib/studyTools.ts` — reuse prompt/schema `QuizQuestion`/`Flashcard` dari fungsi note-based, TANPA persistensi study-store; fungsi note-based tidak diubah

## 2. API Chat Quiz & Flashcards

- [x] 2.1 Buat `app/api/assistant/quiz/route.ts` (POST `{ sessionId, count }`): `authorizeAssistantUser` + verifikasi kepemilikan sesi, clamp count 5/8/10, generate via `studyContext` + `generateQuizFromContext`, kembalikan `{ questions }`; error jelas (sesi kosong → 422 tanpa panggil AI)
- [x] 2.2 Buat `app/api/assistant/flashcards/route.ts` (POST `{ sessionId }`): pola sama → `{ cards }`
- [x] 2.3 Mount `/api/assistant/quiz` dan `/api/assistant/flashcards` di `backend/src/routes.ts`

## 3. UI Kuis & Flashcards di Chat

- [x] 3.1 Buat `components/asisten/ChatQuizModal.tsx`: pilih jumlah soal (5/8/10) → generate via `apiFetch` → jawab/submit → skor + pembahasan per soal → regenerate; bottom-sheet mobile, tombol ≥44px, safe-area
- [x] 3.2 Buat `components/asisten/ChatFlashcardModal.tsx`: generate → flip kartu, navigasi prev/next, restart; `postProgress` `cards_add` (20xp) saat generate & `cards_review_all` (10xp) saat deck selesai
- [x] 3.3 Deteksi command di `app/chat/[id]/page.tsx`: input composer yang di-trim case-insensitive sama dengan `/kuis` atau `/card` membuka modal terkait dan TIDAK dikirim sebagai pesan AI; sesi tanpa pesan tetap buka modal dengan pesan info
- [x] 3.4 Verifikasi mobile: kedua modal berperilaku bottom-sheet di viewport sempit, konten panjang scroll internal, tidak ada overflow halaman

## 4. Survey Performa Eureka

- [x] 4.1 Buat `app/api/feedback/note/route.ts`: GET `{ answered, earliestNoteCreatedAt }` (dari row `note_feedback` + `notes.created_at` paling awal milik user); POST `{ rating?, suggestion?, dismissed? }` — rating wajib saat submit, dismiss insert row `dismissed=true`, submit kedua ditolak (409) jawaban pertama dipertahankan
- [x] 4.2 Mount `/api/feedback/note` di `backend/src/routes.ts`
- [x] 4.3 Buat `components/asisten/FeedbackSurveyModal.tsx`: rating 1-5 (wajib, tombol ≥44px) + saran opsional + submit/dismiss; bottom-sheet mobile + safe-area
- [x] 4.4 Hook di `app/chat/[id]/page.tsx`: pada load, GET status → jika `answered` jangan tampilkan; jika ada `earliestNoteCreatedAt` hitung delay hingga +60 dtk (tampilkan segera jika sudah lewat, jeda ~1,5 dtk); flag localStorage anti-flash saat kunjungan yang sama; muncul pertama kali setelah `NoteProgressOverlay` selesai (catatan pertama)

## 5. Verification

- [x] 5.1 Uji command detection & builder konteks via skrip `node:test` di `scripts/` (tanpa jaringan: deteksi `/kuis`/`/card`, sesi kosong, format konteks)
- [x] 5.2 `openspec validate` (change), `npm run lint`, `npx tsc --noEmit`, backend `npm run typecheck`, `npm run build`
- [ ] 5.3 Smoke API: POST quiz/flashcards tanpa auth → 401 (✓ terverifikasi: 400/401); sesi bukan milik user → 403 & sesi kosong → 422 butuh token user asli — gabung ke QA manual 5.4
- [ ] 5.4 QA manual browser (desktop + mobile viewport): `/kuis` & `/card` membuka modal tanpa balasan AI; sesi dengan mention catatan menyertakan materi catatan; skor & pembahasan tampil; XP flashcard tercatat; survey muncul ~1 menit setelah catatan pertama & tidak muncul lagi setelah submit/dismiss; duplikat POST feedback ditolak