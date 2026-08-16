## 1. Multi-sumber: backend & prosesor

- [x] 1.1 Ubah `NotesProcessorInput` di `lib/notesProcessor.ts` menjadi array `sources: NoteSource[]` (type, url, soalText, fileBuffer, fileName), maks 5, dan adaptasi `processNoteForBackground` agar mengekstrak & menggabung semua sumber sebelum pipeline AI
- [x] 1.2 Ubah `app/api/notes/process/route.ts` untuk menerima `sources` (JSON array metadata) + beberapa field file, validasi (≥1, ≤5, jenis valid, link/file wajib per jenis), dan teruskan ke prosesor
- [x] 1.3 Tambahkan helper validasi/penanganan sumber gagal (identifikasi sumber mana yang gagal, pesan spesifik, keputusan lanjut/batal)

## 2. Multi-sumber: UI

- [x] 2.1 `components/dashboard/CreateNoteModal.tsx`: ganti state sumber tunggal menjadi daftar `sources` (maks 5) dengan penambah per jenis, ringkasan per baris (jenis + nama/URL), tombol hapus, dan pengiriman FormData multi-sumber
- [x] 2.2 `components/note/NoteCreateWizard.tsx`: dukung beberapa sumber pada alur wizard chat dengan batas 5 dan antarmuka yang sama (ringkasan + hapus per sumber) — alur chat via `NoteProgressOverlay` di-update ke format `sources` baru (wizard sendiri hanya mengumpulkan preferensi; sumber berasal dari prompt)

## 3. Mata pelajaran per-user: SQL & store

- [x] 3.1 Tulis `supabase_patch_015_user_subjects.sql` (idempoten): tambah `user_id`, hapus subjek global lama, drop policy RLS lama + constraint UNIQUE(name), tambah UNIQUE(user_id, name), policy RLS per-user
- [x] 3.2 `lib/subjects-store.ts`: semua fungsi menerima `userId` dan memfilter per user; cek duplikat nama di-scope per user
- [x] 3.3 `app/api/subjects/route.ts` & `app/api/subjects/[id]/route.ts`: ambil `userId` dari header Authorization (`getUserIdFromAuth`/`authorizeAssistantUser`), GET/POST/DELETE hanya data milik pemanggil

## 4. Uji Pemahaman: generator & endpoint

- [x] 4.1 Tambah `generateComprehension` di `lib/studyTools.ts`: soal ABC + essay dari bab catatan dengan parameter `count`, `difficulty`, `types`, output tervalidasi (ABC: options+answer; essay: modelAnswer; keduanya: explanation)
- [x] 4.2 Tambah `gradeEssayAnswers` di `lib/studyTools.ts`: AI menilai jawaban essay terhadap modelAnswer/materi → status benar/kurang tepat/salah + penjelasan koreksi
- [x] 4.3 Tambah `extractQuestionsFromSheet` di `lib/studyTools.ts` (atau file terpisah): ekstrak soal dari gambar via vision (`aiChat` + `visionImage`) dan dari PDF via `extractTextFromFile` (PDF scan tanpa teks → error pesan jelas)
- [x] 4.4 Endpoint `POST /api/notes/[id]/comprehension` (body count/difficulty/types → `generateComprehension`, validasi count 3–15, 422 jika catatan tanpa bab)
- [x] 4.5 Endpoint `POST /api/notes/[id]/comprehension/grade` (body questions+answers → `gradeEssayAnswers`)
- [x] 4.6 Endpoint `POST /api/notes/[id]/comprehension/upload` (multipart file → `extractQuestionsFromSheet`, batas ukuran, error terbaca/tidak)

## 5. Uji Pemahaman: UI

- [x] 5.1 Buat `components/note/ComprehensionModal.tsx`: langkah 1 pilih mode (dari materi / upload lembar soal), langkah 2 pengaturan (jumlah, kesulitan, toggle ABC/essay, atau upload), langkah 3 pengerjaan di halaman (radio ABC + textarea essay) + tombol kumpulkan
- [x] 5.2 Tampilkan hasil: skor akhir, status tiap soal, jawaban benar, penjelasan (explanation untuk ABC, grade AI untuk essay); tombol coba lagi
- [x] 5.3 Tambahkan tombol "Uji Pemahaman" di `ACTION_BUTTONS` `app/dashboard/note/[id]/page.tsx` dan wiring modal (termasuk state kosong catatan tanpa bab)

## 6. Verifikasi

- [x] 6.1 `npm run build` sukses
- [x] 6.2 Verifikasi runtime: endpoint multi-sumber (validasi ≥1 & ≤5), subjek per-user (401 tanpa token), comprehension/grade/upload (validasi & 404) — via server lokal
- [x] 6.3 Jalankan `openspec validate` pada change ini
