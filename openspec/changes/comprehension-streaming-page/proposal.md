## Why

Fitur Uji Pemahaman saat ini dibuka sebagai **modal** (`ComprehensionModal`) dengan loading statis "Membuat soal..." — terasa sempit untuk latihan soal dan tidak menunjukkan AI sedang bekerja. Pengguna ingin (1) pengalaman **halaman interaktif penuh** (bukan popup) untuk mengerjakan soal, dan (2) animasi **realtime** saat AI sedang menulis soal pilihan ganda (ABC) dan essay, seperti mengetik langsung di layar (efek ChatGPT).

## What Changes

- **Halaman interaktif Uji Pemahaman** — alur latihan dipindah dari modal ke halaman tersendiri (`/dashboard/note/[id]/uji-pemahaman`): pilih mode (dari materi / upload lembar soal), atur jumlah & tingkat kesulitan, kerjakan soal langsung di halaman, lihat skor & penjelasan. Tombol "Uji Pemahaman" di halaman catatan berubah dari membuka modal menjadi **navigasi** ke halaman ini.
- **Streaming realtime saat menulis soal** — endpoint baru `POST /api/notes/[id]/comprehension/stream` memakai `aiChatStream` (SSE): token jawaban AI diteruskan ke halaman secara realtime dan ditampilkan sebagai teks yang sedang "diketik" (efek menulis). Setelah AI selesai, teks mentah di-parse menjadi soal terstruktur dan halaman transisi ke mode pengerjaan.
- **Mode upload lembar soal tetap** — pindah ke halaman baru dengan alur yang sama (foto/scan/PDF → AI ekstrak soal), tetap dengan umpan balik realtime saat mengekstrak.
- **Penilaian & penjelasan tetap** — skor, jawaban benar, penjelasan untuk jawaban salah, dan koreksi essay AI dipertahankan di halaman baru.

## Capabilities

### New Capabilities

- (tidak ada capability baru)

### Modified Capabilities

- `comprehension-test`: alur Uji Pemahaman dipindah dari modal ke halaman interaktif (`/dashboard/note/[id]/uji-pemahaman`), tombol di halaman catatan jadi navigasi, dan proses pembuatan soal berjalan streaming realtime dengan efek "AI sedang menulis soal".

## Impact

- **Frontend pages**: halaman baru `app/dashboard/note/[id]/uji-pemahaman/page.tsx` (di dalam layout dashboard yang sudah ada); `app/dashboard/note/[id]/page.tsx` — tombol "Uji Pemahaman" berubah jadi `router.push` ke halaman baru (hapus wiring modal).
- **Komponen**: `components/note/ComprehensionModal.tsx` dipindah/diadaptasi menjadi komponen halaman (`components/note/ComprehensionPage.tsx` atau komponen dalam halaman baru); komponen baru untuk area "menulis realtime" (streaming text) dan pengerjaan soal.
- **API**: endpoint baru `app/api/notes/[id]/comprehension/stream/route.ts` (SSE streaming token via `aiChatStream`, parse JSON di akhir, kirim `done` dengan soal); endpoint lama `comprehension` (non-stream) tetap untuk upload/fallback; `grade` & `upload` tidak berubah.
- **Backend registry**: `backend/src/routes.ts` perlu mendaftarkan route stream baru (`/api/notes/:id/comprehension/stream`) agar backend Hono (port 3001) tetap melayani.
- **Lib**: `lib/studyTools.ts` — tambah fungsi `streamComprehension` (atau refactor `generateComprehension` untuk streaming) yang memakai `aiChatStream` + parse JSON final; `lib/ai.ts` tidak berubah.
- **Sistem**: tidak ada perubahan DB, auth, atau deployment.
