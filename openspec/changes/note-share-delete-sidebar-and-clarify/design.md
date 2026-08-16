# Design: Share & Hapus Catatan, Sidebar Collapse, 404, Klarifikasi Prompt, Study Buddy

## Context

Motivasi dan cakupan ada di proposal.md. Kondisi saat ini yang relevan:

- **404**: belum ada `app/not-found.tsx` — Next.js memakai template default.
- **Share chat sudah ada** sebagai pola: tabel `ai_chat_shares` (snapshot) + halaman publik `/share/[token]` (server component, `getShare`). Share **catatan** belum ada; kolaborasi per-akun (`/api/notes/[id]/collab` + InviteModal, role editor/viewer) terpisah dan bukan link publik.
- **Delete note**: `app/api/notes/[id]/route.ts` hanya GET/PATCH. Semua tabel anak (chunks, note_images, collaborators, chapter_notes, flashcards, versions, dll.) sudah `ON DELETE CASCADE` ke `notes`.
- **Sidebar**: `components/layout/Sidebar.tsx` — desktop `w-[220px]` fixed (`hidden lg:flex`), mobile drawer dengan `isOpen`. Tidak ada state collapse.
- **Chat asisten**: `POST /api/assistant/chat` → `aiChatStream` (SSE token). Tidak ada tahap klarifikasi.
- **Study Buddy**: `BuddyChatPopup.tsx` (chat biasa, `ChatMessage {role, content, timestamp}`), `StudyBuddyProvider`, `TriggerSystem`, `StudyBuddyWidget`, endpoint `/api/study-buddy/chat`. Tampilan popup masih generik (gray/dark), belum clay.
- **Pengaturan**: `app/dashboard/pengaturan/page.tsx` — gaya generik gray/dark, belum clay.
- **Backend Hono** (`backend/src/routes.ts`) memount route `app/api` secara manual — setiap route API baru WAJIB didaftarkan di sana (insiden 404 kemarin).

## Goals / Non-Goals

Goals:
- 404 custom, share note publik read-only, hapus note, sidebar collapse, klarifikasi prompt (chat asisten), Study Buddy tanya realtime + kuis, halaman pengaturan clay.

Non-Goals (di luar scope):
- Tidak mengubah model kolaborasi per-akun yang sudah ada (InviteModal tetap).
- Tidak menambah halaman edit publik — halaman share murni read-only.
- Klarifikasi hanya di chat asisten (`/chat/[id]`), bukan wizard buat catatan.
- Tidak ada persisten hasil kuis Study Buddy (skor sesi, ephemeral).

## Decisions

### 1. Halaman 404 custom — `app/not-found.tsx` global
Next.js otomatis memakai `app/not-found.tsx` untuk semua rute yang tidak cocok. Buat satu file global dengan gaya clay: logo, pesan ramah, tombol "Kembali ke Dashboard" (jika ada sesi) / "Ke Beranda". Cek sesi via `lib/auth` (isLoggedIn) dengan komponen client kecil agar bisa memilih tujuan.

### 2. Share catatan — tabel `note_shares` + halaman publik read-only
- Patch SQL idempoten `supabase_patch_016_note_shares.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS public.note_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ALTER TABLE public.note_shares ENABLE ROW LEVEL SECURITY;
  -- SELECT publik via token: security definer function (catatan publik = snapshot read-only)
  ```
  Akses publik memakai **security definer function** `get_public_note_by_token(token)` yang hanya mengembalikan `id, title, chapters` (kolom baca) — RLS default tetap melindungi tabel lain. (Alternatif: RLS policy `USING (true)` pada note_shares + SELECT notes — ditolak karena membocorkan notes; fungsi definer lebih ketat.)
- API: `POST /api/notes/[id]/share` (auth pemilik; return `{ token, url }`) dan `GET /api/share/note/[token]` (tanpa auth; return judul + chapters; 404 bila token tak dikenal).
- Halaman publik `app/share/note/[token]/page.tsx` (server component): render judul + bab memakai `ParsedContent` (render markdown/code yang sudah konsisten), tanpa AuthGuard, tanpa kontrol edit.
- UI: `ShareNoteModal` baru di halaman catatan (tombol share di toolbar) — tampilkan link, tombol salin, tombol "buka halaman" & "batal".
- Catatan: halaman share publik → **robots noindex** (metadata) agar tidak terindeks Google.

### 3. Hapus catatan — `DELETE /api/notes/[id]`
- Handler DELETE: auth via `authorizeAssistantUser` (sama seperti GET/PATCH), verifikasi `note.user_id === userId`, lalu `delete from notes where id = $1` — semua tabel anak terhapus oleh FK cascade (sudah diverifikasi di skema). `note_shares` juga cascade.
- UI: tombol hapus (Trash2) di toolbar halaman catatan + menu/ikon di kartu dashboard (`NoteItem`) — keduanya memakai dialog konfirmasi (modal kecil bergaya clay, bukan `window.confirm`), lalu `router.push("/dashboard")` / refresh daftar.

### 4. Sidebar collapse desktop
- State `collapsed` di `Sidebar.tsx`, persist ke `localStorage("eureka_sidebar_collapsed")` (inisialisasi lazy). Layout: wrapper desktop `w-[220px]` ↔ `w-[72px]` dengan `transition-[width]`, label menu `hidden` saat collapsed, ikon tetap + `title` tooltip.
- Tombol toggle (PanelLeftClose/PanelLeftOpen) di header sidebar (desktop only, `hidden lg:flex`). Mobile drawer tidak berubah.
- Konten dashboard memakai `lg:pl-[220px]`? — cek layout dashboard; bila lebar sidebar dikontrol di `app/dashboard/layout.tsx`, pindahkan width ke sana agar konten ikut menyesuaikan (bila sidebar & konten flex sibling, cukup perubahan class sidebar).

### 5. Klarifikasi prompt ambigu (chat asisten `/chat/[id]`)
- Tahap **deteksi** sebelum streaming: `POST /api/assistant/chat` mula-mula memanggil `aiChatJson` ringan (model cepat, `maxTokens` kecil) dengan prompt: "Nilai apakah prompt ambigu & butuh klarifikasi; bila ya, buat ≤4 pertanyaan pilihan ganda (2–4 opsi)". Output `{ needsClarification: boolean, questions: [{id, question, options[]}] }`.
- Bila `needsClarification` → respons 200 JSON `{ clarification: questions }` (tanpa stream). Bila tidak → lanjut ke `aiChatStream` seperti sekarang.
- Klien: bubble khusus `ClarificationCard` (kartu clay, pertanyaan + tombol opsi, tombol "Langsung jawab"); jawaban dikumpulkan → kirim ulang `POST` dengan `clarifications: [{id, answer}]` + prompt asli; server menyuntikkan jawaban ke konteks sistem lalu stream normal.
- Hanya aktif bila key AI tersedia; deteksi gagal → fallback jawab langsung (tidak memblokir chat).
- Biaya: satu panggilan JSON murah per pesan — dibatasi `maxTokens` kecil (≈300) dan hanya untuk pesan user.

### 6. Study Buddy interaktif + popup clay + pengaturan
- **Tipe pesan baru** `question` di storage chat buddy: `{ role: "buddy", type: "question", content: "...", options: string[], questionId, answer?: string }`. Bubble question merender tombol opsi (dengan ikon centang saat dipilih); klik opsi → kirim `POST /api/study-buddy/chat` dengan `{ action: "answer", questionId, answer, context }`.
- Endpoint `/api/study-buddy/chat` diberi mode: `intent` dari request (`chat` default, `ask_context`, `quiz`) + konteks tersimpan. Alur: saat aktif & tanpa konteks → buddy kirim pertanyaan konteks (1–3 MCQ, dijawab satu per satu); mode `quiz` → soal bergantian, penilaian via AI (`aiChatJson`), skor akhir ephemeral.
- **Redesign popup**: ganti warna generik dengan class clay yang sudah ada (kartu, tombol, avatar `PixelArtAvatar` tetap), dukung dark mode via `dark:` classes.
- **Pengaturan**: refactor `app/dashboard/pengaturan/page.tsx` memakai `card-clay`, kontrol clay, `dark:` classes konsisten dengan sidebar/profil.

## Risks / Trade-offs

- **Deteksi klarifikasi menambah latency** (satu panggilan JSON per pesan) → model cepat + `maxTokens` kecil; fallback langsung bila gagal. [Risk] deteksi salah memicu klarifikasi pada prompt jelas → ambang konservatif di prompt deteksi (hanya bila benar-benar kurang info inti).
- **Fungsi definer Supabase** salah tulis bisa bocor data → hanya mengembalikan kolom yang aman (id, title, chapters), tidak menerima parameter selain token, `search_path` di-pin.
- **Hapus catatan permanen** (tidak ada undo) → dialog konfirmasi eksplisit dengan nama/peringatan "tidak bisa dikembalikan".
- **Sidebar collapse** berinteraksi dengan layout dashboard → verifikasi manual di semua breakpoint; state hanya di desktop (mobile drawer tak terpengaruh).
- **Route Hono backend** — lupa daftar route baru = 404 di produksi → tasks menyertakan langkah registrasi `backend/src/routes.ts` + verifikasi curl untuk tiap endpoint baru.
- **Klarifikasi di chat lama** — pesan klarifikasi tidak boleh masuk history chat sebagai pesan biasa; dikirim sebagai payload terpisah (bukan message) agar riwayat bersih.

## Migration Plan

1. Jalankan `supabase_patch_016_note_shares.sql` di Supabase SQL Editor (idempoten) — sebelum deploy fitur share.
2. Deploy frontend (Vercel, otomatis via push) + backend (VPS: `git pull` + `pm2 restart eureka-api`) — route API baru (share, delete, clarify, buddy modes) wajib sudah terdaftar di `backend/src/routes.ts`.
3. Rollback: perubahan hanya additive (halaman baru, handler baru, tabel baru). Menghapus fitur = tidak menampilkan tombol; tabel `note_shares` bisa dibiarkan. Tidak ada migrasi data destruktif.

## Open Questions

- Detail tampilan konkret halaman 404 (copywriting & ilustrasi) — bisa diputuskan saat implementasi tanpa mengubah spec.
- Jumlah maksimal pertanyaan konteks Study Buddy (1–3) — default 3, bisa disesuaikan.
- Apakah halaman pengaturan perlu tab baru (mis. "Preferensi AI") — tidak ditentukan; redesign visual dulu.
