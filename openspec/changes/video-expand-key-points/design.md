## Context

Embed video YouTube sudah ada di chat (`/chat/[id]`) dan kartu "Video Sumber" di halaman catatan (change `youtube-chat-and-note-from-chat`): komponen `components/video/YoutubeEmbed.tsx` (click-to-play, youtube-nocookie) + `lib/assistant/videoUrl.ts`. Catatan bersumber YouTube sudah menyimpan `keyPoints` ("Poin Penting") dari pipeline pembuatan catatan. Backend Hono (`backend/src/routes.ts`) melakukan mount eksplisit route Next.js (pola `/api/assistant/*`). Lihat proposal.md — Why dan specs untuk kontrak perilaku.

## Goals / Non-Goals

**Goals:**
- Tombol View pada embed video (chat & note) membuka overlay expand: video kiri + poin kanan.
- Poin selalu generate AI dari transkrip; cache hasil generate; tanpa perubahan DB/CSP.
- Endpoint terautentikasi + rate limit.

**Non-Goals:**
- Poin interaktif berbasis timestamp transkrip (klik poin → lompat ke menit) — di luar scope.
- Generate poin otomatis setiap embed tampil (hanya saat View dibuka).
- Perubahan pada embed tanpa View (perilaku click-to-play lama tetap).
- Sumber poin dari `keyPoints` catatan — diputuskan AI-only (tabel `notes` tidak menyimpan `keyPoints`; tanpa migrasi DB).

## Decisions

### 1. Tampilan expand berupa overlay `VideoViewOverlay` (bukan inline)

Overlay full-screen (pola `NoteProgressOverlay`/`ChatQuizModal`: `AnimatePresence` + `fixed inset-0 z-50`), konten grid `lg:grid-cols-2`: **video kiri, panel poin kanan**; di mobile stack vertikal (video atas). Dibuka dari state di halaman (`viewVideo: { url, title?, noteId? } | null`), ditutup via tombol X / klik area luar.

- **Alasan**: konsisten di chat & note tanpa mengubah tata letak halaman; "di samping kanan" terpenuhi lewat grid desktop. Inline expansion di bubble chat akan merusak lebar pesan.
- **Alternatif**: expand inline di kartu — hanya cocok di halaman catatan, tidak di bubble chat.

### 2. Tombol View di `YoutubeEmbed` via prop `onView`

`YoutubeEmbed` mendapat prop opsional `onView?: (url: string) => void` + `autoPlay?: boolean`. Saat `onView` ada, tombol "View" kecil tampil (pojok kanan atas thumbnail / bawah player). Halaman menyambungkan ke overlay.

- `app/chat/[id]/page.tsx`: state `viewVideo`; `MessageBubble` menerima `onViewVideo` dan meneruskannya ke `YoutubeEmbed` → overlay tanpa `noteId`.
- `app/dashboard/note/[id]/page.tsx`: `YoutubeEmbed` di kartu "Video Sumber" diberi `onView` → overlay dengan `noteId: data.id`.

### 3. Overlay auto-play video

Saat overlay terbuka, `YoutubeEmbed` di dalamnya memakai `autoPlay` (iframe langsung `?autoplay=1`) sehingga video yang sedang ditonton "tetap berjalan" di tampilan expand (memenuhi spec scenario "video yang sedang diputar tetap berjalan"). Embed asli di belakang overlay tetap utuh.

### 4. Orkestrasi poin di `lib/videoPoints.ts` (server)

`getVideoPoints(url)`:
1. **Cache in-memory** — Map `videoId → { points, fetchedAt }` TTL 1 jam (class `VideoPointsCache` dengan jam bisa diinjeksi agar teruji); ada → `{ points, source: "ai", cached: true }`.
2. **Generate** — `scrapeYoutubeTranscript(url)` (reuse `lib/rag/extract.ts`); teks dipotong ~20.000 karakter; prompt AI via `aiChat` (non-stream, maxTokens ~600, temperature 0.4): "Buat 5–8 poin penting dari transkrip video ini dalam bahasa Indonesia, satu poin per baris diawali '- '". Parse via fungsi murni `parsePoints` (strip `-`/`•`/nomor, filter kosong, dedupe, cap 8); simpan cache → `{ points, source: "ai", cached: false }`.
3. **Transkrip tidak tersedia** → kembalikan penanda error `no-transcript` (UI menampilkan pesan jujur).

- **Alasan**: reuse penuh pipeline ekstraksi & pola AI yang ada; cache mencegah biaya AI berulang saat buka/tutup panel. `parsePoints` & `VideoPointsCache` sengaja murni (tanpa import) agar bisa diuji node:test; `scrapeYoutubeTranscript` & `aiChat` dipanggil via dynamic import agar modul tetap bisa di-import node:test.
- **Trade-off**: cache in-memory hilang saat server restart (serverless) — hanya menunda, tidak merusak perilaku (generate ulang sekali).

### 5. Endpoint `POST /api/video/points`

Pola route asisten lain (`app/api/assistant/quiz`):
- Body `{ url, userId }`; validasi URL YouTube (`extractYoutubeVideoId` dari `lib/assistant/videoUrl`).
- `authorizeAssistantUser` (token Supabase wajib cocok dengan `userId` body — sesuai pola route asisten).
- `hasAiKey` check (API key AI wajib untuk generate); rate limit per user `video-points:${userId}` 15/jam (`ensureRateLimitPrune` + `checkRateLimit` — pola `chat-hour` di `app/api/assistant/chat`).
- Respon `{ points, source: "ai", cached }` (200) / `{ error: "no-transcript" }` (422) / 401 / 429 / 400.
- Mount di `backend/src/routes.ts`: `mount(app, "/api/video/points", videoPoints)` — pola mount eksplisit yang sudah ada.

### 6. UI panel poin

Tiga state: loading (spinner + teks "Menyusun poin-poin…"), sukses (list poin, `•` bullet, styling clay), error (pesan sesuai: transkrip tidak tersedia / login / rate limit), plus tombol "Coba lagi" pada error transien. Label sumber poin kecil "dirangkum AI".

## Risks / Trade-offs

- **Biaya AI saat generate poin** → cache 1 jam + hanya dipicu saat View dibuka; rate limit 15/jam.
- **Transkrip panjang** → dipotong ~20k karakter sebelum prompt (pola sama dengan konteks lain).
- **Video tanpa subtitle** → error `no-transcript` → UI pesan jujur, bukan crash.
- **Biaya AI di halaman catatan juga** → cache 1 jam + hanya saat View dibuka + rate limit; tanpa migrasi DB (keputusan user: AI-only).
- **Overlay menutup layar** → pola modal yang sudah dipakai aplikasi; scroll halaman terkunci saat terbuka, dikembalikan saat tutup.
- **Rollback** → murni frontend + satu endpoint; revert commit cukup, tanpa migrasi DB.

## Migration Plan

1. Deploy normal (tidak ada perubahan DB/env/dependency baru — `youtube-transcript` sudah terpasang).
2. Rollback: revert perubahan komponen/halaman/route; endpoint & mount dihapus bersamaan.

## Open Questions

Tidak ada yang mengubah spec/approach/task breakdown. Detail kecil yang bisa diputus belakangan: (a) jumlah poin tepat (5–8) vs tetap 6; (b) apakah perlu tombol "salin poin" — bisa ditambahkan tanpa mengubah spec.
