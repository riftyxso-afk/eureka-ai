## Context

Lihat proposal.md — Why untuk motivasi. State saat ini yang membentuk pendekatan:

- **Pembuatan catatan** (`lib/notesProcessor.ts`, `app/api/notes/process/route.ts`, `components/dashboard/CreateNoteModal.tsx`, `components/note/NoteCreateWizard.tsx`) hanya menerima **satu sumber** per catatan: `sourceType` tunggal + satu `url` ATAU satu `file` ATAU `soalText`. Ekstraksi per jenis ada di `lib/rag/extract.ts` (`scrapeYoutubeTranscript`, `extractTextFromFile`, `transcribeAudioVideo`) dan `lib/firecrawl.ts` (`scrapeWebUrl`).
- **Mata pelajaran** (`lib/subjects-store.ts`, `app/api/subjects/*`, tabel `public.subjects`) bersifat **global**: seed 6 subjek + RLS `SELECT USING (true)` / INSERT untuk semua user terautentikasi. Kolom `name` punya constraint `UNIQUE` global. Catatan menyimpan subjek sebagai teks bebas (bukan FK).
- **Alat belajar** (`lib/studyTools.ts`): `generateQuiz` hanya pilihan ganda, tanpa parameter tingkat kesulitan; `generateQuizFromContext` ephemeral. `app/api/notes/[id]/quiz` memanggil `generateQuiz` dengan `count` saja. UI kuis di `components/note/QuizModal.tsx`; tombol aksi di `app/dashboard/note/[id]/page.tsx` (ACTION_BUTTONS).
- **AI**: `lib/ai.ts` mendukung **vision** (`visionImage: { dataUrl, filename }` dikirim sebagai `image_url`) dengan fallback otomatis ke model non-vision — cocok untuk mengekstrak soal dari foto.
- **Otorisasi**: `lib/assistant/auth.ts` menyediakan `authorizeAssistantUser` dan `getUserIdFromAuth(authHeader)`; `lib/apiClient.ts` (`apiFetch`) otomatis menambah header Authorization.

## Goals / Non-Goals

**Goals:**
- Satu catatan dari hingga 5 sumber campur (dokumen/YouTube/web), diekstrak & digabung sebelum pipeline AI.
- Subjek benar-benar milik per-user: akun baru kosong, tanpa bocor antar-akun, catatan lama utuh.
- Uji Pemahaman: soal ABC + essay dari materi catatan dengan pilihan jumlah & kesulitan, dikerjakan di halaman, penilaian + penjelasan; upload foto/PDF lembar soal untuk diekstrak & dikoreksi AI.

**Non-Goals:**
- Tidak mengubah pipeline pembayaran/auth/deploy.
- Tidak memigrasi nilai subjek pada catatan lama (tetap teks apa adanya).
- Tidak menambahkan tipe sumber baru (audio/video upload) — tetap `comingSoon` seperti sekarang; hanya jumlah sumber yang bertambah.
- Tidak menyimpan riwayat hasil latihan Uji Pemahaman lintas sesi (ephemeral, seperti kuis saat ini).

## Decisions

### D1. Multi-sumber: refactor input prosesor menjadi array sumber

`NotesProcessorInput` diubah dari `{ sourceType, url, soalText, fileBuffer, fileName }` menjadi `{ sources: NoteSource[] }` dengan `NoteSource = { type: "dokumen" | "youtube" | "web" | "soal" | "audio" | "video", url?, soalText?, fileBuffer?, fileName? }`, maksimal **5** item.

- **API** (`app/api/notes/process`): FormData membawa `sources` (JSON array metadata: type + url/soalText) dan beberapa field file (`file0`, `file1`, ...) — file direkonstruksi ke index yang sesuai. Validasi: ≥1 sumber, ≤5, tiap jenis valid, tiap link/file wajib terisi untuk jenisnya.
- **Prosesor** (`lib/notesProcessor.ts`): ekstraksi di-loop per sumber dengan fungsi yang sudah ada, teks digabung dengan pemisah per-sumber (label jenis + nama/URL), lalu pipeline yang ada (bab AI, enrichment, RAG, kuis) berjalan seperti biasa terhadap teks gabungan. `subject` default tetap dari jenis sumber pertama.
- **UI** (`CreateNoteModal`, `NoteCreateWizard`): state `sources: SourceInput[]`, antarmuka "tambah sumber" per jenis dengan daftar ringkas (jenis + nama/URL) dan tombol hapus per baris; tombol tambah nonaktif saat sudah 5.
- **Alternatif ditolak**: memanggil prosesor beberapa kali lalu menggabung catatan hasil — mahal (N× bab AI), hasil tidak koheren; menggabung sebelum pipeline lebih murah dan satu catatan utuh.

### D2. Subjek per-user: kolom `user_id` + RLS + drop constraint UNIQUE global

Patch SQL baru (`supabase_patch_015_user_subjects.sql`, idempoten):
1. `ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS user_id TEXT;`
2. Hapus semua baris global lama: `DELETE FROM public.subjects WHERE user_id IS NULL OR user_id = '';` (sesuai keputusan: data lama dibersihkan; subjek yang dibuat user lain tidak bisa dipindahkan karena tidak tercatat pemiliknya).
3. Drop policy lama (`subjects public read`, `subjects insert`, `subjects delete`) dan constraint `UNIQUE (name)`; ganti dengan `UNIQUE (user_id, name)` (dua user boleh punya "Matematika").
4. Policy RLS baru: SELECT/UPDATE/DELETE `USING (auth.uid()::text = user_id)`, INSERT `WITH CHECK (auth.uid()::text = user_id)`.

- **Store** (`lib/subjects-store.ts`): semua fungsi menerima `userId`; query difilter `.eq("user_id", userId)`; `id` tetap `s-${Date.now()}` (unik cukup per user karena lookup selalu disaring user). Cek duplikat nama di-scope per user.
- **API** (`app/api/subjects/*`): ganti sumber identitas dari query param `userId` menjadi header Authorization via `getUserIdFromAuth`/`authorizeAssistantUser` (konsisten dengan route lain; `apiFetch` sudah mengirim bearer). GET/POST/DELETE semuanya memakai `userId` pemanggil.
- **UI**: `mata-pelajaran` page & `CreateNoteModal` sudah memanggil `/api/subjects` — otomatis per-user; akun baru dapat daftar kosong.
- **Alternatif ditolak**: tabel terpisah `user_subjects` — migrasi lebih besar tanpa manfaat (subjek tidak dipakai lintas fitur selain daftar + nama teks di notes); menambah `user_id` pada tabel yang ada adalah perubahan terkecil.

### D3. Uji Pemahaman: endpoint terpisah + generator dengan kesulitan & essay

- **Endpoint**: `POST /api/notes/[id]/comprehension` — body `{ count, difficulty: "mudah"|"sedang"|"sulit", types: ["abc","essay"] }`. Validasi `count` (3–15), reuse `getNoteWithChunks`, respons `{ questions }`.
- **Generator**: fungsi baru `generateComprehension(noteId, title, chapters, { count, difficulty, types })` di `lib/studyTools.ts` (pola sama seperti `generateQuiz` via `aiChatJson`). Prompt memuat tingkat kesulitan, tipe soal (ABC: 4 opsi + `answer` indeks; essay: `modelAnswer` + poin kunci), dan `explanation` untuk tiap soal. Hasil tervalidasi (ABC wajib opsi ≥2 & answer valid; essay wajib `modelAnswer`), dipotong ke `count`.
- **Penilaian essay**: `POST /api/notes/[id]/comprehension/grade` — body `{ questions, answers }`; AI menilai tiap jawaban essay (benar/kurang tepat/salah) terhadap `modelAnswer` + materi, mengembalikan status & penjelasan koreksi. ABC dinilai deterministik di klien (indeks), essay lewat endpoint ini.
- **Upload lembar soal**: `POST /api/notes/[id]/comprehension/upload` (multipart `file`):
  - **Gambar** (jpg/png/webp) → konversi ke data URL, kirim ke `aiChat` dengan `visionImage` + prompt "ekstrak soal menjadi JSON" (reuse fallback vision bawaan). Hasil di-parse via `extractJsonObject` → daftar soal (ABC/essay, dengan `modelAnswer`/`explanation`).
  - **PDF** → `extractTextFromFile` (officeparser, sudah terpasang). Jika teks kosong (PDF scan), balas pesan: "PDF ini tidak punya teks (scan) — upload foto halamannya".
  - **Alternatif ditolak**: dependency OCR/PDF-to-image baru (`tesseract.js`, `pdfjs-dist`+canvas) — vision model yang sudah ada lebih akurat untuk soal berstruktur (ABC/essay) dan tanpa dependency baru; batasan PDF scan ditangani dengan pesan jelas.
- **UI**: komponen baru `components/note/ComprehensionModal.tsx` dengan 3 langkah: (1) pilih mode — "Dari materi catatan" atau "Upload lembar soal"; (2) pengaturan — jumlah, kesulitan, tipe (toggle ABC/essay), atau upload file; (3) pengerjaan di halaman — radio untuk ABC, textarea untuk essay; tombol "Kumpulkan" → tampil skor, status tiap soal, jawaban benar, dan penjelasan (dari `explanation` soal untuk ABC, dari grade AI untuk essay). Ditambah tombol "Uji Pemahaman" di `ACTION_BUTTONS` halaman catatan (`app/dashboard/note/[id]/page.tsx`).

## Risks / Trade-offs

- [Prompt gabungan multi-sumber menghasilkan teks panjang] → Ekstraksi di-loop dengan batas per-sumber; pipeline yang ada sudah memotong konteks (`buildContext` slice). Batas 5 sumber membatasi pertumbuhan.
- [Migrasi subjek menghapus subjek global; tidak bisa di-rollback ke kondisi lama] → Sesuai keputusan user; patch idempoten & dijalankan sekali; catatan lama tidak tersentuh sehingga tidak ada kehilangan materi belajar.
- [Satu sumber gagal di antara beberapa] → Pesan spesifik sumber mana yang gagal; keputusan lanjut/batal ditampilkan ke user (spec: "sesuai keputusan pengguna"), tidak diam-diam diabaikan.
- [Biaya AI essay grading & ekstraksi gambar] → Grading hanya saat user kumpulkan; hasil tidak dipersistensikan; ukuran upload dibatasi (reuse batas `MAX_UPLOAD_BYTES` yang ada).
- [Vision gagal pada foto buram/terbalik] → Pesan "soal tidak terbaca, coba unggah ulang" + batas ukuran; fallback model non-vision tidak dipakai untuk ekstraksi (hasil tidak berguna), hanya untuk pesan kegagalan.
- [PDF scan tidak ter-extract] → Pesan spesifik + saran upload foto; dicatat di spec sebagai "berkas tidak terbaca → coba unggah ulang".

## Migration Plan

1. **DB**: jalankan `supabase_patch_015_user_subjects.sql` di Supabase SQL Editor (sebelum deploy kode, agar API per-user tidak bertabrakan dengan data lama). Idempoten — aman dijalankan ulang.
2. **Deploy**: commit + push `master` → auto-deploy Vercel (pola proyek).
3. **Verifikasi**: akun baru → daftar subjek kosong; dua akun → subjek saling tidak terlihat; buat catatan 2 dokumen + 1 YouTube → catatan gabungan; Uji Pemahaman → soal ABC+essay, jawab salah → penjelasan; upload foto lembar soal → soal terekstrak & bisa dikerjakan.
4. **Rollback**: revert kode (git) — patch SQL idempoten tidak perlu di-revert; bila perlu, subjek per-user bisa dikembalikan ke perilaku lama dengan policy RLS lama, tetapi subjek global yang sudah dihapus tidak bisa dipulihkan (konsekuensi keputusan "data lama dibersihkan").

## Open Questions

- Tidak ada yang mengubah spec/approach/task breakdown. (Contoh detail yang bisa diputuskan saat implementasi: urutan pemisah label per-sumber di teks gabungan, wording pesan error, ikon tombol Uji Pemahaman.)
