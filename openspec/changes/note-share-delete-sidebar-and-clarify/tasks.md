# Tasks

## 1. Halaman 404 custom

- [x] 1.1 Buat `app/not-found.tsx` global bergaya clay (logo, pesan ramah, kartu) — menggantikan template Next.js
- [x] 1.2 Tambahkan komponen client kecil untuk menentukan tombol tujuan (Dashboard jika ada sesi, else Beranda) + verifikasi rendering di dev

## 2. Sidebar collapse desktop

- [x] 2.1 Tambah state `collapsed` di `components/layout/Sidebar.tsx` dengan persist localStorage (`eureka_sidebar_collapsed`)
- [x] 2.2 Tambah tombol toggle (PanelLeftClose/PanelLeftOpen) hanya desktop; lebar 220px ↔ ~72px dengan transisi; label tersembunyi + tooltip saat collapsed
- [x] 2.3 Pastikan layout dashboard mengikuti lebar sidebar di desktop (cek `app/dashboard/layout.tsx` & breakpoint) — mobile drawer tidak berubah

## 3. Hapus catatan

- [x] 3.1 Tambah handler `DELETE` di `app/api/notes/[id]/route.ts` (auth pemilik, verifikasi `user_id`, hapus via FK cascade)
- [x] 3.2 Daftarkan route DELETE di `backend/src/routes.ts` (method delete)
- [x] 3.3 Tambah tombol hapus + dialog konfirmasi bergaya clay di toolbar halaman catatan (`app/dashboard/note/[id]/page.tsx`) → redirect dashboard
- [x] 3.4 Tambah aksi hapus (ikon + konfirmasi) di kartu dashboard (`components/dashboard/NoteItem.tsx`) → refresh daftar

## 4. Share catatan publik read-only

- [x] 4.1 Buat `supabase_patch_016_note_shares.sql` idempoten: tabel `note_shares` (token unik, FK cascade) + fungsi security definer `get_public_note_by_token`
- [x] 4.2 Buat `POST /api/notes/[id]/share` (auth pemilik; buat token; return url) dan `GET /api/share/note/[token]` (publik; judul + chapters; 404 bila tak dikenal)
- [x] 4.3 Daftarkan kedua route di `backend/src/routes.ts`
- [x] 4.4 Buat halaman publik `app/share/note/[token]/page.tsx` (server component, read-only, render bab via `ParsedContent`, metadata noindex)
- [x] 4.5 Buat `ShareNoteModal` + tombol share di toolbar halaman catatan (salin link, buka halaman, batal)

## 5. Klarifikasi prompt ambigu (chat asisten)

- [x] 5.1 Tambah tahap deteksi di `app/api/assistant/chat/route.ts`: `aiChatJson` ringan menilai ambiguitas → `{ needsClarification, questions[] (≤4, 2–4 opsi) }`; bila ambigu balas JSON klarifikasi, bila tidak lanjut stream seperti biasa; fallback aman saat deteksi gagal
- [x] 5.2 Buat `ClarificationCard` di halaman chat (`app/chat/[id]/page.tsx`): kartu clay, pertanyaan + tombol opsi, tombol "Langsung jawab"; jawaban dikirim ulang bersama prompt asli (tidak masuk history sebagai pesan biasa)
- [x] 5.3 Server: terima `clarifications` pada POST berikutnya dan suntikkan sebagai konteks sebelum streaming

## 6. Study Buddy interaktif + redesign popup + halaman pengaturan

- [x] 6.1 Perluas tipe `ChatMessage` buddy dengan `type: "question"` (content, options, questionId, answer) + render bubble opsi jawaban (tombol pilih) di `BuddyChatPopup.tsx`
- [x] 6.2 Update `POST /api/study-buddy/chat`: dukung intent `ask_context` (tanya konteks 1–3 MCQ saat aktif tanpa konteks) dan `quiz` (soal bergantian + penilaian + skor akhir) via `aiChatJson`; simpan jawaban konteks; daftarkan route di `backend/src/routes.ts` bila ada route baru
- [x] 6.3 Redesign popup Study Buddy ke tema clay (warna, kartu, tombol, dark mode) — fungsi chat lama tetap jalan
- [x] 6.4 Redesign `app/dashboard/pengaturan/page.tsx` ke tema clay (kartu, kontrol, dark mode) tanpa mengubah fungsi

## 7. Verifikasi

- [x] 7.1 `npm run build` sukses tanpa error TS
- [x] 7.2 Verifikasi runtime di backend (port 3001): DELETE note 404/401/200 sesuai kasus, share note GET publik 200, POST share 401 tanpa auth, assistant/chat klarifikasi & buddy intent tidak 404
- [x] 7.3 Verifikasi halaman: `/apa-gitu` → 404 custom, `/share/note/[token]` publik read-only, sidebar collapse di desktop, tombol hapus & share di halaman catatan
- [x] 7.4 `openspec validate --changes` lolos
