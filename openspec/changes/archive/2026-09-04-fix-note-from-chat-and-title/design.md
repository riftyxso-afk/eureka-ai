## Context

Rantai buat-catatan-dari-chat: `Composer` → `onSend` (`app/chat/[id]/page.tsx:447`) mengisi `noteHistory` dari `chat.renderedMessages` → `NoteProgressOverlay` (`components/note/NoteProgressOverlay.tsx:127`) membangun file via `buildChatTranscript` (`lib/assistant/chatTranscript.ts`) → `POST /api/notes/process`. Titik gagal yang dicurigai: placeholder optimis/streaming berkonten kosong ikut menjadi materi; payload FormData ditolak backend; error job tak terlihat user.

Rantai judul sesi: `appendMessage` (`lib/assistant/store.ts:156`) memicu `autoTitleIfNeeded` fire-and-forget (`void`, error tertelan kecuali warn) → update `ai_chat_sessions.title` → sidebar TIDAK pernah di-refresh (`refreshSessions` tak dipanggil) sehingga judul baru tak terlihat sampai reload.

## Goals / Non-Goals

**Goals:**
- Materi dari chat selalu valid (tidak null); kegagalan materi kosong ditolak eksplisit di UI.
- Judul AI ter-generate, tersimpan, dan langsung terlihat di sidebar.

**Non-Goals:**
- Ubah format/isi catatan yang dihasilkan; ubah skema DB; rename manual (sudah ada).

## Decisions

### 1. Saring placeholder kosong di sumber (klien), validasi di backend
**Decision**: `noteHistory` disaring dari pesan berkonten kosong sebelum `buildChatTranscript`; `NoteProgressOverlay` menolak eksplisit bila transkrip + topik kosong (tanpa kirim job). Backend `/api/notes/process` tetap sebagai jaring pengaman (tolak file sumber kosong dengan 400 + pesan jelas).
**Why**: perbaikan di hulu (klien) mencegah job sampah; validasi backend mencegah null lolos dari klien mana pun (termasuk ekstensi).
**Alternatives**: hanya perbaiki backend — ditolak, user tetap menunggu job yang pasti gagal.

### 2. Judul: amankan fire-and-forget + refresh sidebar
**Decision**: `autoTitleIfNeeded` tetap fire-and-forget (jangan perlambat stream) tapi dengan catch yang mencatat error; setelah pesan asisten selesai + `loadMessages`, panggil `refreshSessions` (sudah ada di `sendTo`) — verifikasi bahwa refresh tersebut benar-benar mengambil judul baru (bukan cache), dan tambahkan refresh eksplisit bila perlu.
**Why**: hipotesis terkuat untuk "judul tidak berfungsi" adalah sidebar tak refresh (data benar di DB, UI basi), bukan generate gagal.
**Alternatives**: polling judul — ditolak, boros dan tak perlu.

### 3. Diagnosis dulu via reproduksi + log, bukan tebak
**Decision**: tasks diawali reproduksi tiap bug dengan bukti (payload FormData aktual, isi `ai_chat_sessions.title` di DB, log server) sebelum mengubah kode.
**Why**: dua hipotesis bersaing per bug; bukti memilih yang benar.

## Risks / Trade-offs

- **[Filter terlalu agresif]** → pesan pendek valid ikut terbuang. Mitigasi: saring hanya konten kosong setelah trim, bukan pesan pendek.
- **[Refresh sesi tiap pesan]** → request ekstra. Mitigasi: refresh hanya bila sesi masih berjudul default saat kirim.
- **[AI title lambat]** → judul muncul belakangan. Mitigasi: fallback potongan prompt langsung, AI menimpa bila selesai (tetap fire-and-forget).

## Open Questions

- Apakah default title di DB selalu persis "Percakapan baru" (cek konsistensi dengan `createSession`)? Dijawab saat diagnosis (task 1.1).
