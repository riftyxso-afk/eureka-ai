## Why

Embed video YouTube (dari change `youtube-chat-and-note-from-chat`) sudah bisa ditonton di chat & halaman catatan, tapi belum ada cara melihat **isi video secara ringkas** sambil menontonnya. Pengguna ingin: klik "View" pada video → tampilan melebar (video di kiri) dengan **poin-poin isi video di kanan** — jadi bisa paham inti video sekilas tanpa membaca transkrip panjang.

## What Changes

- **Tombol "View" pada embed video** — setiap embed video (di chat `/chat/[id]` dan kartu "Video Sumber" di `/dashboard/note/[id]`) mendapat tombol View. Klik → terbuka tampilan expand (overlay) dengan layout lebar: **video di kiri, panel poin-poin di kanan** (di mobile menumpuk vertikal). Bisa ditutup kembali ke tampilan biasa.
- **Poin-poin isi video (generate AI dari transkrip)** — panel kanan menampilkan poin-poin penting video: sistem mengekstrak transkrip dan AI meringkasnya menjadi 5–8 poin dalam bahasa Indonesia (berlaku di chat maupun halaman catatan). Hasil generate di-cache sementara (per video) agar tidak memanggil AI berulang kali saat user membuka/tutup panel. Bila transkrip tidak tersedia, panel menampilkan pesan jujur bahwa poin tidak bisa dibuat.
- **Endpoint baru** `POST /api/video/points` — auth seperti endpoint asisten lain, rate limit, dan pengecekan API key AI.

## Capabilities

### New Capabilities

- `video-expand-key-points`: tampilan expand "View" pada embed video YouTube (chat & halaman catatan) dengan panel poin-poin isi video di samping kanan — sumber poin dari `keyPoints` catatan bila ada, fallback generate AI dari transkrip.

### Modified Capabilities

- (tidak ada — change `youtube-chat-and-note-from-chat` yang memperkenalkan embed belum di-archive, jadi capability `youtube-video-chat` belum ada di main specs; behavior baru ini menjadi capability baru yang berdampingan)

## Impact

- **Frontend pages**: `app/chat/[id]/page.tsx` & `app/dashboard/note/[id]/page.tsx` — state untuk membuka overlay view video (dengan URL video + `noteId` bila di halaman catatan).
- **Komponen**: `components/video/YoutubeEmbed.tsx` — tambah tombol View di pojok embed (opsional via prop `onView`); komponen baru `components/video/VideoViewOverlay.tsx` — overlay full-screen (pola `NoteProgressOverlay`/`ChatQuizModal`): grid video kiri + panel poin kanan, loading/generate/error state, tombol tutup; mobile stack vertikal.
- **API**: endpoint baru `app/api/video/points/route.ts` (POST `{ url, noteId? }` → `{ points, source: "note" | "ai", cached }`); auth via `authorizeAssistantUser`, rate limit, `hasAiKey` check. Backend Hono proxy (`backend/src/routes.ts`) perlu mount `/api/video/points` — mengikuti pola mount eksplisit `/api/assistant/*` yang sudah ada.
- **Lib**: `lib/videoPoints.ts` — orkestrasi poin: cache in-memory per videoId (TTL ~1 jam) → `scrapeYoutubeTranscript` + prompt AI ringkas (5–8 poin) via `aiChat`; fungsi parse & cache dibuat murni agar bisa diuji node:test; reuse `lib/rag/extract.ts` & pola rate limit yang ada.
- **Sistem**: tidak ada perubahan DB, CSP (iframe sudah diizinkan), atau deployment.

## Asumsi (dari klarifikasi user)

- Berlaku di **chat DAN halaman catatan**.
- Sumber poin: **AI-only — generate dari transkrip** (keputusan user: tabel `notes` tidak punya kolom `key_points` dan `keyPoints` tidak dipersist saat pembuatan catatan, jadi jalur "poin dari catatan" tidak dipakai; tanpa perubahan DB).
- Expand berupa **overlay** (bukan inline) agar konsisten di kedua halaman; "video di kiri, poin di kanan" → grid 2 kolom desktop, stack mobile.
