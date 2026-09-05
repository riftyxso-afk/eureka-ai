## Context

Bubble chat (`components/asisten/MessageBubble.tsx` + `MarkdownView.tsx`) sekarang render link sebagai teks/anchor biasa; preview YouTube hanya ada sebagai `YoutubeEmbed` click-to-play di `VideoViewOverlay` atau `youtube-video-chat` player terpisah, tidak inline di bubble. `lib/rag/extract.ts` sudah punya `scrapeYoutubeTranscript` (dengan fallback Whisper) dan `scrapeWebUrl` (Firecrawl) yang dipakai untuk buat catatan, tapi belum ada endpoint ringan untuk preview metadata. `framer-motion` sudah dipakai untuk `WebSearchPipeline` collapse/expand. Lihat `proposal.md - Why`.

## Goals / Non-Goals

**Goals:**
- Link di bubble langsung ngasih konteks visual (thumbnail/og:image + judul) tanpa buka tab baru, tetap ringan (default collapsed).
- Satu komponen `LinkEmbed` yang handle YouTube & web dengan API & UI yang sama (collapse/expand animasi, tombol Ringkas, subtitle realtime).
- Subtitle realtime sinkron akurat pakai `segments` existing, tidak re-fetch transkrip saat play.

**Non-Goals:**
- Tidak membangun browser preview full (iframe web umum) — hanya card OG metadata (hindari XSS/CSP).
- Tidak mengubah pipeline buat catatan atau `notesProcessor`; Ringkas hanya panggil `generateAiSummary` ringan, bukan full pipeline.
- Tidak menyimpan history embed di DB; embed di-render client-side dari `content` bubble.

## Decisions

**1. Deteksi link di bubble vs Markdown link**
- **Keputusan**: Di `MessageBubble`/`MarkdownView`, setelah `normalizeMathDelimiters`, scan `content` dengan regex URL (YouTube patterns dari `extractYoutubeId` + `https?://` umum) sebelum `ReactMarkdown`, atau sebagai `remark` plugin yang emit `linkEmbed` node; render di bawah `ReactMarkdown` sebagai `LinkEmbed` list (urutan kemunculan). Teks bubble tetap utuh.
- **Alternatif**: Hanya andalkan `remark` link node (`[text](url)`) — ditolak, user sering paste bare URL tanpa markdown.
- **Rationale**: Bare URL adalah 90% kasus di chat; scan manual menangkap keduanya.

**2. Metadata preview — endpoint `/api/link-preview`**
- **Keputusan**: Baru `GET /api/link-preview?url=` (cache 1 jam, `lru-cache` atau `next/cache`), server panggil `scrapeWebUrl` untuk web umum (title/favicon/og:image/description) dan `fetchYoutubeTitle` + `oembed` untuk YouTube (thumbnail `https://img.youtube.com/vi/{id}/hqdefault.jpg`). Client fetch sekali per URL, tidak block render bubble.
- **Alternatif**: Fetch langsung di client via `fetch` OG — ditolak, CORS & Firecrawl butuh key server.
- **Rationale**: Reuse `scrapeWebUrl` yang sudah handle Firecrawl + fallback; cache cegah hit berulang untuk link yang sama di history.

**3. UI collapse/expand & Ringkas**
- **Keputusan**: `components/bubble/LinkEmbed.tsx` (atau `components/asisten/LinkEmbed.tsx`) — card `rounded-clay-md` `border-2` `bg-clay-cream`, header favicon/thumbnail + title + domain + chevron `▾` (rotate 180 saat expanded) + tombol `Ringkas` (kecil, `press` sound via `cuelume`). Konten expand pakai `motion.div` `height:auto` (reuse `WebSearchPipeline` pattern), `AnimatePresence` untuk `stagger` jika ada 2+ link.
- **Alternative**: Modal terpisah — ditolak, user minta inline di bubble.
- **Rationale**: Konsisten dengan `WebSearchPipeline` collapse yang baru, animasi smooth 0.25s.

**4. Subtitle realtime**
- **Keputusan**: Saat play, `YoutubeEmbed` emit `onTimeUpdate` (via YouTube IFrame API `getCurrentTime()` polling 100ms atau `onStateChange`); parent `LinkEmbed` cari `segment` aktif (`offsetMs <= current*1000 < offsetMs+durationMs`), set `activeIndex`, render list subtitle di panel bawah player dengan `highlight-slide`/`typewriter` (reuse `hl-ai-adding` di `ParsedContent`). Auto-scroll `ref.current.scrollIntoView({behavior:"smooth"})`. Transcript `segments` di-cache dari `scrapeYoutubeTranscript` saat buat preview (atau fetch lazy saat pertama play jika belum ada).
- **Alternatif**: Pakai `track` WebVTT — ditolak, YouTube IFrame tidak expose track untuk semua video; `segments` sudah ada.
- **Rationale**: Sinkron akurat tanpa re-transcribe, animasi reuse yang sudah ada.

## Risks / Trade-offs

- **Banyak link di satu bubble → layout berat** → Mitigasi: batasi `max 3` embed per bubble, sisanya `+N link lainnya` collapsed.
- **Fetch metadata lambat / Firecrawl 429** → Mitigasi: skeleton `EurekaOrb searching` di card, timeout 5s, tampil fallback domain-only, tidak block chat.
- **Subtitle sync drift jika user seek** → Mitigasi: polling 100ms + `seeked` event → recalc `activeIndex` langsung.
- **YouTube thumbnail tanpa CC / Shorts** → Mitigasi: preview tetap tampil (thumbnail + judul), subtitle panel tampil "Subtitle tidak tersedia" tanpa error, tombol Ringkas tetap jalan (pakai Whisper fallback di backend jika dipanggil).

## Migration Plan

1. Tambah `app/api/link-preview/route.ts` (GET, cache), `components/bubble/LinkEmbed.tsx` + `SubtitleRealtime.tsx`, update `MessageBubble.tsx`/`MarkdownView.tsx` untuk scan & render `LinkEmbed` di bawah teks, tambah tipe `LinkEmbedItem` di `lib/assistant/types.ts`.
2. `npm run build` + `npx tsc --noEmit` 0; test manual: kirim `https://youtu.be/...` dan `https://contoh.com` di bubble → cek collapsed, expand, Ringkas, play → subtitle jalan.
3. Rollback: hapus render `LinkEmbed` di `MessageBubble`, bubble kembali teks link biasa; `youtube-video-chat` tetap jalan.

## Open Questions

- Apakah `Ringkas` perlu simpan hasilnya sebagai catatan baru atau cukup inline di bubble? — Ditunda, default inline; jika user minta simpan, follow-up `note-from-chat` sudah ada.
- Perlu batas tinggi subtitle panel (mis. `max-h-32 overflow-y-auto`) atau full? — Ditunda, default `max-h-28` scroll, lihat feedback.
