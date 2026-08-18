## Why

Eureka sudah bisa membuat catatan dari link YouTube (transkrip diekstrak menjadi bab), tapi pengguna belum bisa **menonton videonya sambil berdiskusi realtime dengan AI** — baik di halaman chat maupun halaman catatan. Selain itu, saat pengguna minta "buatkan catatan" di tengah percakapan, catatan hanya dibuat dari prompt literal, bukan dari **topik yang sedang dibahas** di chat, sehingga hasilnya sering meleset dari konteks percakapan. Ini adalah dua peningkatan "v2" yang membuat Eureka lebih terasa seperti tutor yang bisa melihat dan mendiskusikan materi video bersama pengguna.

## What Changes

- **Embed video YouTube di chat** — saat pengguna mengirim pesan yang memuat link YouTube (youtube.com/watch, youtu.be, shorts, embed), video dirender sebagai player inline (click-to-play) di bawah pesan user. Video "aktif" di sesi ikut dibawa ke pertanyaan-pertanyaan berikutnya.
- **AI berdiskusi tentang video secara realtime** — server mengekstrak transkrip video (reuse `scrapeYoutubeTranscript`) dan menyuntikkannya sebagai konteks jawaban AI; jawaban tetap streaming SSE realtime seperti sekarang. AI bisa menjawab pertanyaan tentang isi video, dan video tanpa subtitle mendapat fallback (judul + pengakuan jujur + tetap bisa dibahas dari konteks umum).
- **Embed video di halaman catatan** — catatan yang berasal dari sumber YouTube (`subject = "YouTube"`, `sourceUrl` terisi) menampilkan player video di halaman `/dashboard/note/[id]`, sehingga pengguna bisa menonton video sambil membaca catatan dan bertanya ke AI (`NoteAIChat`) tentang materi yang berasal dari video tersebut.
- **Buat catatan dari topik chat** — saat pengguna mengetik "buatkan catatan" di composer `/chat`, riwayat percakapan terkini (topik yang sedang dibahas) dikirim sebagai konteks ke pipeline pembuatan catatan (`/api/notes/process`), sehingga catatan digenerate sesuai topik diskusi, bukan hanya teks prompt. Alur wizard F&Q, overlay progres, dan halaman hasil tetap sama.
- **CSP** — `frame-src` pada `next.config.mjs` ditambah `https://www.youtube.com` (dan `https://www.youtube-nocookie.com` bila dipakai) agar iframe player bisa tampil.

## Capabilities

### New Capabilities

- `youtube-video-chat`: embed video YouTube di halaman `/chat/[id]` dan `/dashboard/note/[id]`, plus kemampuan AI berdiskusi tentang isi video secara realtime (SSE) menggunakan transkrip sebagai konteks.
- `note-from-chat`: pembuatan catatan dari `/chat` berdasarkan topik percakapan — riwayat chat terkini menjadi konteks sumber materi selain prompt user.

### Modified Capabilities

- (tidak ada capability lama yang berubah tingkat requirement — perilaku pembuatan catatan dari sumber URL/dokumen di `notes` tetap seperti sebelumnya; `note-from-chat` adalah jalur sumber baru yang berdampingan)

## Impact

- **Frontend pages**: `app/chat/[id]/page.tsx` — deteksi link YouTube pada pesan composer, kirim `videoUrl` ke API, render embed di bubble pesan user, dan operkan riwayat percakapan ke `NoteProgressOverlay` saat intent "buat catatan"; `app/dashboard/note/[id]/page.tsx` — render `YoutubeEmbed` saat catatan bersumber YouTube.
- **Komponen**: komponen baru `YoutubeEmbed` (click-to-play, lazy iframe) dipakai di chat & note; `NoteProgressOverlay` menerima prop `history`/`chatContext` dan meneruskannya ke `/api/notes/process`; bubble pesan user menampilkan embed; tipe `AssistantChatMessage`/payload chat menampung `videoUrl`.
- **API**: `app/api/assistant/chat/route.ts` — terima `videoUrl`, ekstrak transkrip, suntik konteks video ke system prompt (mode "VIDEO"); `app/api/notes/process/route.ts` — terima field `chatContext` opsional dan jadikan bagian dari materi sumber. `backend/src/routes.ts` hanya perlu mount bila ada route baru (tidak ada route baru — perubahan di route yang sudah ter-mount).
- **Lib**: reuse `scrapeYoutubeTranscript`/`extractYoutubeId` dari `lib/rag/extract.ts`; helper konteks video di `lib/assistant/` (batas panjang transkrip, fallback tanpa subtitle); `lib/assistant-stream.ts`/`buildAssistantChatBody` menambah field `videoUrl`.
- **Sistem**: `next.config.mjs` — tambah YouTube ke CSP `frame-src`. Tidak ada perubahan DB, auth, atau deployment.
