## Context

- Halaman `/chat` (client component, `app/chat/[id]/page.tsx`) sudah punya composer (`components/asisten/Composer.tsx`), chat auth (`authorizeAssistantUser`), dan akses DB via service-role `db()` di `lib/supabase/admin.ts`. Semua route API baru harus di-mount juga di `backend/src/routes.ts` (honoAdapter).
- Sudah ada pola kuis/flashcard berbasis note: `generateQuiz`/`generateFlashcards` di `lib/studyTools.ts` (AI via `aiChatJson` + `extractJsonObject`, output `QuizQuestion`/`Flashcard`), disimpan ke `lib/study-store.ts` (keyed per noteId), dimainkan lewat `components/note/QuizModal.tsx` & `FlashcardModal.tsx` (bottom-sheet mobile-first, touch target ≥44px, safe-area). Flashcard note memberi XP (`cards_add` 20xp, `cards_review_all` 10xp) via `postProgress`; kuis note tidak memberi XP.
- `Message` (lib/assistant/types.ts) punya `mentions: string[]` (id catatan). Pembuatan catatan dari chat lewat `NoteProgressOverlay` → `/api/notes/process` (job + SSE/polling).
- Env Supabase sudah terkonfigurasi (`.env.local`); semua patch SQL ditulis sebagai `supabase_patch_NNN_*.sql` dan diterapkan manual di Supabase SQL editor.

## Goals / Non-Goals

**Goals:**
- Command `/kuis` dan `/card` di composer chat membuka popup interaktif tanpa mengirim ke AI sebagai pesan biasa.
- Materi kuis/card diambil dari isi percakapan sesi + konten catatan yang di-mention, dipotong agar cost/latency terkendali.
- Survey performa muncul sekali per user, ~1 menit setelah catatan pertama selesai; jawaban masuk DB dengan jaminan anti-duplikat server-side.
- Semua UI baru mobile-first mengikuti pola modal yang sudah ada.

**Non-Goals:**
- Tidak memodifikasi alur kuis/flashcard note yang sudah ada (tetap keyed per noteId, tetap tersimpan di study-store).
- Tidak menyimpan hasil kuis/flashcard chat ke database — hasil bersifat ephemeral per sesi, digenerate ulang tiap command.
- Tidak ada argumen tambahan pada command (mis. `/kuis 10`) — jumlah soal dipilih di dalam popup, konsisten dengan QuizModal note.
- Survey tidak ditambahkan ke halaman lain selain halaman chat.

## Decisions

### 1. Deteksi command di sisi klien, exact-match
Submit composer dicegat: jika input (trim, case-insensitive) sama persis dengan `/kuis` atau `/card`, buka popup terkait dan jangan kirim ke AI. Tidak memakai deteksi intent server-side (seperti `noteIntent`) karena menambah latensi & biaya AI untuk aksi yang sudah eksplisit.
- Alternatif ditolak: deteksi substring (`input.startsWith("/kuis")`) — rentan memicu popup saat user menulis teks biasa yang diawali `/kuis ...`.

### 2. Route API baru per sumber materi (sesi + mentions)
- `POST /api/assistant/quiz` `{ sessionId, count }` → `authorizeAssistantUser` + verifikasi kepemilikan sesi → kumpulkan konteks → AI → `{ questions }`.
- `POST /api/assistant/flashcards` `{ sessionId }` → pola sama → `{ cards }`.
- Util baru `lib/assistant/studyContext.ts`: membangun konteks dari pesan sesi (role + content, dipotong ~20k karakter seperti `buildContext`) + konten catatan mention (via store note yang sudah ada; catatan tanpa bab/sudah terhapus → pakai judul saja atau dilewati).
- Generator: tambahkan `generateQuizFromContext(context, count)` dan `generateFlashcardsFromContext(context)` di `lib/studyTools.ts` yang memakai prompt/schema JSON yang sama dengan fungsi note-based (output `QuizQuestion`/`Flashcard`), tapi tanpa persistensi study-store. Fungsi note-based tidak diubah.

### 3. Komponen baru, bukan generalisasi modal lama
Buat `components/asisten/ChatQuizModal.tsx` & `ChatFlashcardModal.tsx` yang menyalin pola interaksi modal note (jawab → skor + pembahasan, flip + navigasi, XP card via `postProgress`), tapi memanggil endpoint chat. Modal note tidak diubah.
- Alasan: QuizModal/FlashcardModal terkopling dengan API note + study-store + konteks wizard; menyentuhnya berisiko regresi di alur note. Trade-off: duplikasi ~200 baris per komponen — diterima demi isolasi.
- Alur chat beda dari note: command `/kuis`/`/card` langsung AUTO-GENERATE saat popup terbuka (loading skeleton langsung tampil, kuis default 5 soal) — tanpa layar konfirmasi awal seperti di note. Opsi jumlah soal (5/8/10) muncul pada alur regenerasi ("Ulangi" → pilih jumlah → generate).

### 4. Survey: kebenaran di server, jadwal dari DB
- Tabel baru `note_feedback` (id, user_id NOT NULL UNIQUE, rating SMALLINT NULL, suggestion TEXT NULL, dismissed BOOLEAN NOT NULL DEFAULT false, created_at) + RLS owner-only (select/insert). UNIQUE user_id = jaminan sekali-per-user.
- `GET /api/feedback/note` → `{ answered: boolean, earliestNoteCreatedAt: string | null }` (dari `notes.created_at` paling awal milik user). `answered = true` jika ada row `note_feedback` — maka survey tidak pernah muncul lagi (mencakup skenario "user yang sudah pernah buat catatan sebelum fitur": earliestNoteCreatedAt ada tapi sudah lama → tetap eligible, benar sesuai spec).
- Klien (chat page): jika `answered` → selesai. Jika `earliestNoteCreatedAt` ada → hitung delay hingga +60 detik; jika masih di masa depan, `setTimeout`; jika sudah lewat (mis. user kembali esok hari), tampilkan setelah jeda singkat (~1,5 dtk). Jika user keluar halaman dalam window 1 menit, delay dihitung ulang dari `earliestNoteCreatedAt` saat kunjungan berikutnya — tidak ada state lokal yang perlu dipertahankan.
- `POST /api/feedback/note` `{ rating?, suggestion?, dismissed? }`: submit → validasi rating 1-5 wajib; dismiss → insert row `(rating NULL, dismissed true)`. Keduanya memenuhi UNIQUE user_id; submit kedua ditolak (409) dan jawaban pertama dipertahankan.
- Anti-spam lapis kedua: flag localStorage `eureka_feedback_dismissed` agar modal tidak langsung muncul lagi pada kunjungan yang sama sebelum respons server.

### 5. Mobile-friendly sebagai standar bawaan
Komponen baru memakai pola modal yang sudah terbukti: `fixed inset-0` + `items-end` di mobile (bottom sheet) → `sm:items-center`, `pb-[max(12px,env(safe-area-inset-bottom))]`, `max-h-[80dvh] overflow-y-auto`, tombol `min-h-[44px]`. Tidak ada tata letak desktop-only.

### 6. Mounting backend
Ketiga route (`/api/assistant/quiz`, `/api/assistant/flashcards`, `/api/feedback/note`) di-mount di `backend/src/routes.ts` mengikuti pola route chat/share yang ada.

## Risks / Trade-offs

- **Biaya/latency AI untuk sesi panjang** → konteks dipotong ~20k karakter; jumlah soal dibatasi 5–10 (sama seperti note).
- **Catatan mention tanpa bab / sudah dihapus** → dilewati atau hanya judulnya dipakai; kuis tetap bisa dibuat dari pesan sesi saja.
- **Modal chat duplikat pola modal note** → dua tempat maintenance; diterima demi menghindari regresi alur note.
- **Dismiss survey = permanen** → user yang menutup tanpa submit tidak akan ditanya lagi (sesuai spec); tidak ada mekanisme re-open.
- **UNIQUE user_id vs banyak user** → row per user; tidak ada dampak performa signifikan.

## Migration Plan

1. Terapkan `supabase_patch_005_note_feedback.sql` manual di Supabase SQL editor (tabel + unique index + RLS). Fitur survey akan 404 sampai patch diterapkan; kuis/card tidak bergantung pada patch.
2. Deploy: perubahan additive; tidak ada breaking change untuk endpoint existing.
3. Rollback: hapus tiga route baru + mount-nya di backend, hapus komponen baru; tabel bisa dibiarkan atau di-drop (aman, tidak dipakai fitur lain).