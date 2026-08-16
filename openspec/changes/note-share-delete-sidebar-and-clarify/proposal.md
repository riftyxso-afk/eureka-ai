# Proposal: Share & Hapus Catatan, Sidebar Collapse, Halaman 404, Klarifikasi Prompt, dan Study Buddy Interaktif

## Why

Pengalaman pengguna masih bolong di beberapa titik penting:

1. **404 default Next.js** — saat user salah ketik URL (mis. `/apa-gitu`), muncul halaman 404 bawaan Next.js yang tidak sesuai branding dan membingungkan. Butuh halaman 404 custom bergaya Eureka dengan jalan pulang yang jelas.
2. **Share catatan belum ada** — user hanya bisa berbagi percakapan chat (`/share/[token]`), padahal catatan adalah aset utama. Kolaborasi per-akun (InviteModal + `/collab`) sudah ada, tapi tidak ada **link publik read-only** yang bisa dibuka siapa pun tanpa login.
3. **Catatan tidak bisa dihapus** — tidak ada tombol hapus sama sekali (API notes hanya GET/PATCH). User tidak bisa merapikan dashboard.
4. **Sidebar desktop kaku** — di desktop lebar 220px selalu terbuka; di layar kecil (laptop 13") ini memakan ruang konten. Butuh collapse/expand.
5. **Prompt ambigu langsung dijawab asal** — saat user menulis prompt yang kurang jelas (mis. "buatkan soal matematika"), AI langsung menebak dan hasilnya sering meleset. Butuh mekanisme klarifikasi: AI bertanya maksimal 4 pertanyaan pilihan ganda sebelum menjawab.
6. **Study Buddy & halaman Pengaturan kurang interaktif** — Study Buddy hanya chat pasif; halaman `/dashboard/pengaturan` masih bergaya generik (gray/dark) tidak konsisten dengan tema clay. Study Buddy perlu bisa **bertanya secara realtime di popup** (tanya konteks belajar saat aktif + kuis percakapan), dan halaman Pengaturan di-redesign agar konsisten.

## What Changes

1. **Halaman 404 custom** (`app/not-found.tsx`) — bergaya clay Eureka: logo, pesan ramah, tombol kembali ke dashboard/beranda, tanpa template Next.js.
2. **Share catatan via link publik read-only** — pemilik membuat token unik (tabel baru `note_shares`); halaman `/share/note/[token]` menampilkan catatan (judul + bab + alat baca) **read-only tanpa login**; pemilik tetap bisa edit/read lewat akunnya. Tombol share di halaman catatan + dialog salin link.
3. **Hapus catatan** — `DELETE /api/notes/[id]` (hanya pemilik) menghapus catatan beserta semua data terkait (chunks, images, collaborators, chapter_notes, flashcards, versions, share tokens); tombol hapus dengan konfirmasi di halaman catatan dan menu kartu di dashboard.
4. **Sidebar collapsible desktop** — tombol toggle di sidebar; collapsed = hanya ikon (lebar ~72px) dengan tooltip; state tersimpan di localStorage; mobile tetap drawer seperti sekarang.
5. **Klarifikasi prompt ambigu di chat asisten** (`/chat/[id]`) — sebelum menjawab, sistem menilai prompt; bila ambigu, AI mengajukan **maksimal 4 pertanyaan pilihan ganda** (dengan 2–4 opsi per pertanyaan); jawaban user dikirim ulang bersama prompt asli, lalu AI menjawab normal. Pengguna bisa melewati klarifikasi (jawab "langsung jawab").
6. **Study Buddy interaktif** — saat buddy aktif, ia bisa mengirim **pertanyaan pilihan ganda realtime di popup** (bubble khusus dengan tombol opsi): (a) tanya konteks belajar saat mulai (target, mapel, kesulitan) untuk menyesuaikan gaya, dan (b) kuis percakapan bergantian dengan penilaian langsung. Popup di-redesign agar konsisten tema clay. Halaman `/dashboard/pengaturan` di-redesign serupa (kartu clay, toggle, konsisten terang/gelap).

## Capabilities

### New Capabilities

- `error-pages`: halaman 404 custom yang konsisten dengan branding clay Eureka (dan siap dipakai untuk error pages lain).
- `navigation`: sidebar desktop yang bisa di-collapse/expand dengan preferensi tersimpan.
- `prompt-clarification`: deteksi prompt ambigu di chat asisten dan alur tanya-jawab maksimal 4 pertanyaan pilihan ganda sebelum AI menjawab.
- `study-buddy`: Study Buddy yang interaktif — bertanya konteks belajar saat aktif dan kuis percakapan dengan opsi jawaban realtime di popup, plus popup yang konsisten tema clay.

### Modified Capabilities

- `notes`: tambah requirement share catatan via link publik read-only, dan hapus catatan (beserta data terkait).
- `app-theme`: tambah requirement halaman `/dashboard/pengaturan` mengikuti tema clay yang konsisten dengan area login.

## Impact

- **Frontend**: `app/not-found.tsx` (baru), `components/layout/Sidebar.tsx` (collapse), halaman catatan (`app/dashboard/note/[id]/page.tsx` — tombol share & hapus), `components/dashboard/NoteItem.tsx` (menu hapus), `components/note/ShareNoteModal.tsx` (baru), halaman publik `app/share/note/[token]/page.tsx` (baru), `app/dashboard/pengaturan/page.tsx` (redesign), `components/study-buddy/*` (popup + tipe pesan pertanyaan), halaman chat (`app/chat/[id]/page.tsx` — UI klarifikasi), `app/chat/[id]/components/ClarificationCard.tsx` (baru).
- **Backend API**: `DELETE /api/notes/[id]` (baru), `POST /api/notes/[id]/share` + `GET /api/share/note/[token]` (baru), `POST /api/assistant/chat` (tahap deteksi ambigu + respons klarifikasi), `POST /api/study-buddy/chat` (dukungan tanya konteks & kuis). Semua route baru **wajib didaftarkan di `backend/src/routes.ts`** (pelajaran dari insiden 404 route Hono).
- **Database**: patch SQL idempoten `supabase_patch_016_note_shares.sql` — tabel `note_shares` (token unik, note_id, created_at, active) dengan FK cascade ke notes. Tidak ada perubahan tabel lain.
- **Dependency**: tidak ada dependency baru (klarifikasi & QnA memakai pipeline AI yang ada).
