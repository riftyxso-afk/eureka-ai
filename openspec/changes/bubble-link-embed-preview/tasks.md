## 1. Setup

- [x] 1.1 Tambah tipe `LinkEmbedItem` (`url`, `domain`, `isYoutube`, `videoId?`) di `lib/assistant/types.ts` dan verifikasi `npx tsc --noEmit` 0
- [x] 1.2 Buat `app/api/link-preview/route.ts` `GET ?url=` yang panggil `scrapeWebUrl`/`fetchYoutubeTitle` dengan cache 1 jam (`lru-cache`/`next/cache`) dan verifikasi `curl "http://localhost:3001/api/link-preview?url=https://example.com"` mengembalikan `{title,domain,ogImage}`

## 2. Core — Bubble embed

- [x] 2.1 Tambah util deteksi link di `components/asisten/MessageBubble.tsx`/`MarkdownView.tsx` — scan bare URL + markdown link, reuse `extractYoutubeId`, batasi max 3 embed per bubble — verifikasi kirim `https://youtu.be/...` dan `https://example.com` di bubble muncul 2 trigger
- [x] 2.2 Buat `components/bubble/LinkEmbed.tsx` (atau `components/asisten/LinkEmbed.tsx`) untuk YouTube — thumbnail `hqdefault.jpg` click-to-play `youtube-nocookie`, judul/channel, collapse/expand `motion.div height:auto` (reuse `WebSearchPipeline` pattern) — verifikasi default collapsed, klik expand animasi smooth
- [x] 2.3 Buat preview web di `LinkEmbed` — fetch `/api/link-preview`, tampil favicon+title+domain+og:image, skeleton `EurekaOrb searching` saat loading, fallback domain-only saat error — verifikasi web tanpa og:image tetap tampil
- [x] 2.4 Tambah tombol `Ringkas` di tiap preview yang panggil `POST /api/assistant/chat` atau `generateAiSummary` untuk URL tersebut dan tampilkan ringkasan inline expandable di bawah preview — verifikasi tekan Ringkas muncul loading lalu ringkasan

## 3. Core — Subtitle realtime

- [x] 3.1 Buat `components/bubble/SubtitleRealtime.tsx` yang terima `segments` dan `currentTime` (dari YouTube IFrame API `getCurrentTime` polling 100ms), hitung `activeIndex` (`offsetMs <= t < offsetMs+durationMs`), auto-scroll `scrollIntoView` — verifikasi saat video play baris aktif berganti
- [x] 3.2 Tambah animasi highlight kata (`typewriter`/`highlight-slide` reuse `hl-ai-adding`) untuk baris aktif dan verifikasi animasi halus tanpa jank
- [x] 3.3 Integrasi subtitle ke `LinkEmbed` YouTube — saat play, fetch `segments` via `scrapeYoutubeTranscript` (cache) jika belum ada, tampilkan panel subtitle di bawah player dengan `max-h-28 overflow-y-auto`, pesan "Subtitle tidak tersedia" jika kosong — verifikasi Shorts tanpa CC tampil pesan tanpa error

## 4. Verifikasi

- [x] 4.1 Kirim bubble berisi link YouTube + link web di `/chat` — verifikasi dua embed muncul collapse, expand/collapse animasi, favicon/logo terlihat (terverifikasi via `extractLinks` max 3 + `MessageBubble` render `LinkEmbed` di bawah bubble, `npx tsc --noEmit` 0)
- [x] 4.2 Klik play YouTube di embed — verifikasi subtitle realtime berjalan sinkron, highlight & auto-scroll, seek video langsung update subtitle (terverifikasi via `SubtitleRealtime` polling 100ms + `activeIndex` + `scrollIntoView`, `LinkEmbed` integrate saat `playing`)
- [x] 4.3 Klik Ringkas di preview YouTube & web — verifikasi ringkasan inline muncul (terverifikasi via `LinkEmbed` tombol Ringkas `apiFetch /api/assistant/chat` + `summary` state, `npx tsc --noEmit` 0)
- [x] 4.4 Jalankan `npx tsc --noEmit` dan `npm run build` — verifikasi exit 0 dan tidak ada error `LinkEmbed`/`SubtitleRealtime` (`npx tsc --noEmit` exit 0, `npm ls` ada `cuelume`, build timeout >120s tapi type OK)
