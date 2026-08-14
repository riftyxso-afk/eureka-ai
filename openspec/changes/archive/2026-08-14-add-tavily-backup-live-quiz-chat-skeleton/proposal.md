## Why

- Web search saat ini hanya mengandalkan Firecrawl; ketika API gagal, limit, atau hasil kosong, jawaban chat kehilangan konteks web tanpa ada cadangan. Tavily sebagai fallback otomatis menjaga kualitas jawaban tanpa mengubah alur pengguna.
- Kuis di halaman catatan bersifat pasif (dikerjakan sendiri, hasil langsung hilang). Pengguna ingin kuis lebih interaktif: bisa dibagikan dan dijawab bersama orang lain secara realtime dengan leaderboard.
- Loading saat memuat percakapan di halaman chat masih spinner lingkaran biasa; skeleton chat (placeholder bubble) terasa lebih natural dan informatif di mobile.

## What Changes

1. **Web search backup dengan Tavily**
   - Tambah env `TAVILY_API_KEY` di backend (diisi sendiri oleh pengguna lewat dashboard/SSH).
   - Fallback otomatis: bila `firecrawlSearch` gagal/return kosong → coba `tavilySearch` dengan format hasil yang sama.
   - Berlaku di semua pemakai web search: tool web search assistant chat, enrichment bab catatan (`lib/webSearchEnrichment.ts`), dan pencarian gambar PDF (`lib/pdfImages.ts`).

2. **Kuis halaman catatan interaktif + share + jawab realtime**
   - Setelah kuis selesai (score tampil), muncul tombol-tombol interaktif di bawah hasil: **Bagikan Kuis** dan **Buat Ruang Live**.
   - **Bagikan**: membuat link publik (view-only) kuis; penerima link bisa mengerjakan kuis yang sama.
   - **Ruang Live**: host membuat room → link room dibagikan → orang lain join → semua menjawab soal yang sama serentak → skor & leaderboard tersinkron realtime via Supabase Realtime.
   - Diterapkan pada modal kuis halaman catatan (`components/note/QuizModal.tsx`).

3. **Loading skeleton di halaman chat**
   - Ganti spinner lingkaran saat memuat percakapan (`chat.loading && messages.length === 0`) dengan skeleton chat (placeholder bubble pengguna + AI yang berdenyut), responsif mobile & desktop.

## Capabilities

### New Capabilities
- `web-search`: Pencarian web multi-provider (Firecrawl utama, Tavily fallback) untuk assistant chat & enrichment catatan; hasil diformat seragam.
- `quiz-live`: Pembagian kuis via link publik + ruang kuis live (room, partisipan, jawaban, skor, leaderboard realtime) untuk kuis halaman catatan.
- `chat-loading`: State loading percakapan di halaman chat berupa skeleton (bukan spinner).

### Modified Capabilities
- (tidak ada — `chat-share` tidak berubah; web search/kuis/chat belum punya spec lama)

## Impact

- **Backend**: env baru `TAVILY_API_KEY`; file `lib/tavily.ts`; fallback di `lib/firecrawl.ts` (atau pemanggilnya); route baru `/api/quiz-shares`, `/api/quiz-rooms`, `/api/quiz-rooms/[id]` (+ mount di `backend/src/routes.ts`); tabel Supabase baru (share token, room, partisipan, jawaban) via patch SQL.
- **Frontend**: `components/note/QuizModal.tsx` (tombol baru + mode room), halaman `app/quiz-share/[token]` / `app/quiz-room/[id]` (atau satu halaman gabungan), `lib/quizRoom.ts` (klien realtime), `app/chat/[id]/page.tsx` (skeleton).
- **Pemakai `firecrawlSearch` yang ikut terpengaruh**: `app/api/assistant/chat/route.ts`, `lib/webSearchEnrichment.ts`, `lib/pdfImages.ts`, `lib/noteEnrich.ts`.
- **Infra**: pola Realtime Supabase yang sudah ada (presence/collab) dipakai ulang untuk sinkronisasi room.