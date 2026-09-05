## Why

Chat bubble sekarang hanya menampilkan link sebagai teks biasa; pengguna harus buka tab baru untuk tahu isi link. Padahal link YouTube/web adalah sumber belajar utama di Eureka — preview embed yang collapse/expand langsung di bubble plus ringkasan dan subtitle realtime akan mempercepat pemahaman tanpa pindah konteks.

## What Changes

- Deteksi link YouTube (`youtu.be`, `youtube.com/watch`, `/shorts`, `/embed`) dan link web umum di `bubble text` pesan user/assistant; render **embed preview** inline di bawah teks bubble.
- Preview YouTube: thumbnail click-to-play (youtube-nocookie), judul, channel, durasi, tombol **Ringkas** (panggil pipeline ringkas) dan **Expand/Collapse** (default collapsed, animasi `framer-motion` height).
- Preview web umum: fetch metadata (title, favicon, og:image, deskripsi) via `scrapeWebUrl`/Firecrawl, tampil sebagai card kecil (favicon + title + domain + image), juga collapse/expand dan tombol Ringkas.
- Saat klik play video: overlay/panel menampilkan **subtitle realtime** yang berjalan sinkron dengan playback (highlight kata/kalimat aktif, auto-scroll, animasi `typewriter`/`highlight-slide`), pakai `transcript segments` (`offsetMs`/`durationMs`) yang sudah ada di `scrapeYoutubeTranscript`.
- Tombol **Ringkas** di preview memanggil `processNoteForBackground`/`generateAiSummary` untuk link tersebut dan menampilkan ringkasan inline (expandable).

## Capabilities

### New Capabilities
- `bubble-link-embed`: Embed preview link (YouTube & web) di dalam chat bubble — deteksi link, fetch metadata/thumbnail, render card collapse/expand dengan animasi, tombol ringkas, dan integrasi subtitle realtime saat video diputar.

### Modified Capabilities
- `youtube-video-chat`: Tambah subtitle realtime beranimasi saat video di-embed diputar (sebelumnya hanya player statis + konteks transkrip untuk AI).

## Impact

- **Code**: `components/asisten/MessageBubble.tsx` & `MarkdownView.tsx` (render link → embed), `components/video/YoutubeEmbed.tsx` atau baru `LinkEmbed.tsx`, `lib/rag/extract.ts` (reuse `scrapeYoutubeTranscript`, `scrapeWebUrl`), `lib/assistant/types.ts` (tipe embed), `app/api/link-preview` (baru, proxy metadata), `components/asisten/WebSearchPipeline.tsx` (reuse collapse pattern).
- **APIs**: Baru `GET /api/link-preview?url=` (cache OG metadata), reuse `POST /api/assistant/chat` untuk ringkas; tidak ada breaking change.
- **Dependencies**: `framer-motion` sudah ada untuk animasi collapse/expand & subtitle highlight; `youtube-transcript` & `firecrawl` reuse.
- **UX**: Bubble tetap ringan (default collapsed, tinggi terbatas), expand tidak mengganggu scroll chat; subtitle realtime hanya aktif saat video play.
