## Context

Overlay View (`components/video/VideoViewOverlay.tsx`) dari change `video-expand-key-points` menampilkan grid 2 kolom: video (kiri, `YoutubeEmbed` auto-play) dan panel poin (kanan). Kolom kiri saat ini hanya berisi video — ada ruang kosong di bawahnya. `scrapeYoutubeTranscript` (`lib/rag/extract.ts`) sudah mengembalikan `segments: { text, offsetMs }` (sumber `youtube-transcript`, mencoba bahasa `id` lalu fallback default) dan dipakai untuk poin video. Proyek memakai design system claymorphism (token `clay-*`: beige, borderLight, shadow, primary) dan pola route asisten terproteksi (`authorizeAssistantUser` + cache in-memory + rate limit, lihat `/api/video/points`). CSP di `next.config.mjs` saat ini mengizinkan `frame-src` YouTube tetapi `script-src` belum.

## Goals / Non-Goals

**Goals:**
- Panel subtitle claymorphism di bawah video dalam overlay View yang sinkron akurat dengan pemutaran (termasuk pause/seek/buffering).
- Endpoint transkrip bertimestamp yang aman dan ter-cache, tanpa biaya AI.
- Klik baris subtitle → seek video.
- Degradasi wajar saat subtitle atau IFrame API tidak tersedia.

**Non-Goals:**
- Subtitle pada embed di luar overlay (bubble chat / kartu catatan) — panel hanya di overlay View.
- Pengeditan/terjemahan subtitle, atau pemilihan trek bahasa oleh pengguna.
- Sinkronisasi lewat estimasi waktu dinding (dianggap tidak andal, lihat keputusan 1).

## Decisions

### 1. Sinkronisasi akurat via YouTube IFrame API + polling, bukan estimasi waktu dinding
Iframe pemutar diberi `enablejsapi=1`; overlay memuat skrip `https://www.youtube.com/iframe_api` sekali (singleton promise), lalu `new YT.Player(iframeEl)` membungkus iframe yang sudah ada (didapat via callback `onIframeReady` dari `YoutubeEmbed`). Posisi dibaca `player.getCurrentTime()` tiap 250 ms saat overlay terbuka; status play/pause dari `onStateChange` (polling dihentikan saat `ENDED`/tutup). **Alternatif yang ditolak**: kalkulasi waktu dinding sejak autoplay — rusak saat pause, seek, buffering, dan tab di-background. IFrame API terbukti bekerja dengan embed `youtube-nocookie`.

### 2. Endpoint baru `POST /api/video/transcript`, pola identik `/api/video/points`
`{ url, userId }` + header Authorization → `authorizeAssistantUser` → validasi `extractYoutubeVideoId` → cache hit (in-memory per videoId, TTL 1 jam) langsung balas → miss: `scrapeYoutubeTranscript`, kembalikan `{ title, segments: [{ text, offsetMs, durationMs }] }` (cap ~2000 segmen, buang teks kosong). Tanpa API key AI. Guardrail konsisten repo: rate limit ringan 30/jam per user **hanya pada miss** (proteksi biaya scraping YouTube; tidak mempersempit behavior spec). Status: 200 / 400 URL invalid / 401 belum login / 422 tanpa subtitle / 429 kena limit.

### 3. Cache & logika murni di `lib/videoTranscript.ts` (teruji)
`TranscriptCache` (Map + TTL, jam injectable — bentuk sama dengan `VideoPointsCache`) dan helper murni `activeSegmentIndex(segments, timeMs)` (pencarian linear pada segmen terurut; segmen aktif = `offsetMs <= t < offsetMs + durationMs`, fallback durasi = jarak ke segmen berikutnya bila `durationMs` 0) agar bisa diuji `node:test` tanpa jaringan. I/O lewat dynamic import (pola `lib/videoPoints.ts`).

### 4. Panel subtitle di kolom kiri, claymorphism
Kolom kiri jadi `flex flex-col`: video di atas (`aspect-video`), panel di bawah dengan tinggi dibatasi (`max-h` + `overflow-y-auto`, mis. `lg:max-h-[30vh]`) agar overlay tetap muat di viewport. Gaya: `rounded-clay-md border-2 border-clay-borderLight bg-clay-beige shadow-clay-sm`, header kecil "Subtitle" + status, segmen aktif `bg-clay-primary/10 border-l-4 border-clay-primary font-bold text-clay-dark` (skala sedikit via transition), segmen lain `text-clay-muted`. Auto-scroll `scrollIntoView({ block: "nearest" })` hanya saat segmen aktif berubah (tidak menggagalkan scroll manual pengguna). Klik baris → `player.seekTo(offsetMs/1000, true)` + `playVideo()`.

### 5. Degradasi jujur
- Subtitle tak tersedia (422) → panel menampilkan pesan "Video ini tidak memiliki subtitle" tanpa tombol coba-ulang otomatis; video & panel poin tetap jalan.
- IFrame API gagal dimuat (jaringan/CSP) → panel tetap menampilkan daftar segmen statis dengan catatan kecil "sinkronisasi tidak tersedia", tanpa highlight/auto-scroll.
- Gagal koneksi lain → pesan + tombol "Coba lagi" (pola panel poin).

### 6. CSP & `YoutubeEmbed`
Tambah `https://www.youtube.com` ke `script-src` (hanya host itu, tanpa wildcard) untuk skrip `iframe_api`. `YoutubeEmbed`: tambah `enablejsapi=1` ke src iframe (tidak mengubah perilaku embed lain) dan prop `onIframeReady` (callback node iframe). `TranscriptSegment` di `lib/rag/extract.ts` ditambah `durationMs?` (dari `t.duration` library, tanpa mengubah konsumen lain).

### 7. Backend proxy
Mount `/api/video/transcript` di `backend/src/routes.ts` di samping `/api/video/points` (proxy Hono memetakan route asisten secara eksplisit).

## Risks / Trade-offs

- [CSP `script-src` sedikit melonggar (tambah `youtube.com`)] → Hanya host tunggal resmi; tanpa `'unsafe-eval'`/wildcard; `frame-src` sudah mengizinkan YouTube.
- [IFrame API tidak jalan di beberapa kasus (jaringan/CSP lama, blocker iklan)] → Degradasi ke daftar statis (keputusan 5), panel tidak kosong.
- [Video panjang → ribuan segmen] → Cap 2000 segmen ke klien; offset berjarak (gap antar segmen) tetap valid karena pakai rentang `offset..offset+duration`.
- [Polling 250 ms tiap overlay terbuka] → Dihentikan saat tutup/`ENDED`; biaya trivial.
- [Cache in-memory hilang saat instance server restart] → Hanya memicu satu pengambilan ulang per video (biaya rendah, tanpa AI).

## Migration Plan

Tidak ada migrasi DB. Deploy: kode + perubahan CSP ikut config (restart diperlukan agar header baru aktif di dev). Rollback: revert file terkait (`VideoViewOverlay`, `YoutubeEmbed`, route baru, `next.config.mjs`, `backend/src/routes.ts`); CSP lama tidak lagi mengizinkan skrip IFrame API → panel otomatis degradasi ke daftar statis tanpa perubahan kode tambahan.

## Open Questions

Tidak ada — keputusan yang tersisa (posisi panel, perilaku klik) sudah diputuskan di atas dan tidak mengubah spec.
