## Why

Tiga keluhan utama pengguna: (1) catatan hanya bisa dibuat dari **satu** sumber padahal materi belajar sering tersebar di beberapa dokumen/video/halaman; (2) tabel mata pelajaran bersifat **global** — subjek yang ditambah satu user ikut tampil di akun semua orang, dan akun baru langsung diberi 6 subjek bawaan; (3) fitur latihan di halaman catatan terbatas — kuis hanya pilihan ganda tanpa kontrol jumlah/kesulitan, tidak ada tipe essay, tidak ada penjelasan saat jawab salah, dan tidak ada cara menguji pemahaman dari lembar soal fisik.

## What Changes

- **Multi-sumber saat buat catatan** — pengguna bisa menggabungkan sampai **5 sumber** bebas campur (dokumen PDF/DOCX/PPTX, link YouTube, link web) dalam satu catatan; teks semua sumber diekstrak, digabung, lalu diolah AI menjadi satu catatan utuh.
- **Mata pelajaran per-user** — **BREAKING**: tabel `subjects` global (dengan 6 subjek seed + RLS public) diubah menjadi per-user: akun baru mulai dengan **0 subjek**, user menambah sendiri, dan subjek milik user lain tidak pernah terlihat/dapat diakses. Subjek global lama dihapus; catatan lama tetap utuh (kolom `subject` di notes adalah teks bebas dan tidak dihapus).
- **Uji Pemahaman di halaman catatan** — tombol baru di halaman catatan untuk melatih pemahaman materi: AI membuat soal dari isi catatan dengan pilihan **jumlah soal & tingkat kesulitan** (mudah/sedang/sulit), tipe **pilihan ganda (ABC) dan essay**, dikerjakan langsung di halaman; jawaban salah menampilkan **penjelasan**; skor ditampilkan setelah selesai.
- **Upload lembar soal** — pengguna bisa **upload foto/scan lembar soal** (gambar/PDF) di halaman uji pemahaman; AI mengekstrak soal dari gambar, membuatkannya bisa dikerjakan di halaman (ABC + essay), dan mengoreksi jawaban dengan penjelasan.

## Capabilities

### New Capabilities

- `subjects`: mata pelajaran milik per-user — akun baru kosong, CRUD subjek hanya untuk pemilik, tanpa kebocoran antar-akun.
- `comprehension-test`: uji pemahaman di halaman catatan — generasi soal dari materi catatan (jumlah & tingkat kesulitan dapat diatur, tipe ABC + essay), pengerjaan di halaman, penjelasan jawaban salah, dan upload lembar soal untuk diekstrak AI.

### Modified Capabilities

- `notes`: kebutuhan multi-sumber saat pembuatan catatan — maksimal 5 sumber campur (dokumen/YouTube/web) digabung menjadi satu catatan.

## Impact

- **DB**: patch SQL baru — migrasi `subjects` (hapus seed global, tambah `user_id`, perketat RLS) + `ALTER` yang diperlukan; catatan tidak berubah skema.
- **API**: `app/api/subjects/*` (filter & tulis per-user), `app/api/notes/process` (terima beberapa sumber), endpoint baru uji pemahaman (`app/api/notes/[id]/comprehension` atau sejenisnya) + endpoint upload lembar soal.
- **Backend lib**: `lib/subjects-store.ts` (per-user), `lib/notesProcessor.ts` + `NotesProcessorInput` (array sumber), `lib/studyTools.ts` (generasi soal dengan kesulitan & essay, ekstraksi soal dari gambar).
- **UI**: `components/dashboard/CreateNoteModal.tsx` & `components/note/NoteCreateWizard.tsx` (pilih beberapa sumber), `app/dashboard/mata-pelajaran/page.tsx` (subjek milik sendiri), `app/dashboard/note/[id]/page.tsx` + komponen baru (tombol & modal Uji Pemahaman).
- **Dependensi**: kemungkinan tambah library OCR/vision (pakai model AI vision yang sudah ada jika memungkinkan) untuk ekstraksi soal dari gambar.
- **Sistem**: tidak ada perubahan pada pipeline pembayaran, auth, atau deployment.
