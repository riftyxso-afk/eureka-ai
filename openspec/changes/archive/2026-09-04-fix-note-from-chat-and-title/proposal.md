## Why

Dua fitur chat yang dijanjikan ke user tidak berfungsi: (1) "buat catatan dari isi chat" menghasilkan catatan null/error — riwayat percakapan tidak sampai menjadi materi sumber; (2) judul riwayat chat yang seharusnya di-generate AI tetap default/tidak berubah. Keduanya merusak kepercayaan pada alur belajar chat → catatan.

## What Changes

- **Diagnosis + perbaikan rantai buat-catatan-dari-chat**: telusuri `Composer` → `noteHistory` (`app/chat/[id]/page.tsx`) → `NoteProgressOverlay` → `buildChatTranscript` (`lib/assistant/chatTranscript.ts`) → `POST /api/notes/process`; perbaiki titik gagal (riwayat kosong karena placeholder optimis/stream, payload FormData ditolak backend, atau error job yang tak terlihat user) serta tampilkan error yang jelas bila materi kosong.
- **Perbaikan generate judul sesi AI**: telusuri `appendMessage` → `autoTitleIfNeeded` (`lib/assistant/store.ts`, fire-and-forget via `void` sehingga gagal diam-diam); pastikan judul ter-generate (AI + fallback potongan prompt), tersimpan, dan sidebar ter-refresh sehingga judul baru langsung terlihat.
- Tanpa perubahan perilaku yang sudah benar; tanpa skema DB baru.

## Capabilities

### New Capabilities
- `assistant-session-title`: judul sesi chat terisi otomatis dari pesan pertama (generate AI + fallback), tersimpan dan terlihat di sidebar tanpa reload.

### Modified Capabilities
- `note-from-chat`: riwayat percakapan WAJIB sampai sebagai materi sumber yang valid (tidak null), dan kegagalan materi kosong WAJIB dilaporkan eksplisit ke user alih-alih catatan null/error diam-diam.

## Impact

- Kode: `app/chat/[id]/page.tsx`, `components/note/NoteProgressOverlay.tsx`, `lib/assistant/chatTranscript.ts`, `lib/assistant/store.ts`, `lib/assistant/useAssistantChat.ts` (refresh sesi), endpoint `app/api/notes/process` (validasi saja bila perlu).
- Tidak ada perubahan skema database; tidak ada dependensi baru.
