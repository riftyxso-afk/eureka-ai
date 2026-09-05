## 1. Setup

- [x] 1.1 Buat `components/streaming/StreamingText.tsx` dari snippet (adaptasi token clay, `framer-motion` tetap) dan verifikasi file ada di repo — real: `content` string dari SSE, bukan mock TOKENS
- [x] 1.2 Tambah keyframes `pop-in` ke `app/globals.css` jika belum ada dan verifikasi `npx tsc --noEmit` 0

## 2. Core Implementation

- [x] 2.1 Implementasi streaming kata `WORD_MS=55` + `cite` chip inline (`SourceChip` dengan `sourceImage`) dan kursor kedip, dan verifikasi `content` 10 kata tampil 5 kata + kursor — real: `isRealString` true → langsung `tokens.length`, `WORD_MS` hanya untuk mock demo
- [x] 2.2 Implementasi bar aksi (4 icons) + toggle `10 sources` (avatar stack + expanded list `Scoop Data` etc.) dan verifikasi `done` → bar `opacity 1`, `sourcesOpen` toggle `grid 1fr` — real: `sources` dari `webResults` SSE, bukan mock
- [x] 2.3 Implementasi daftar sumber expandable (link `a` dengan `image` + `domain` mono) dan `Follow-ups` 2 tombol dengan `fade-up 90ms` stagger, dan verifikasi klik `onFollowUp` dipanggil — real: `followUps` dari props, `onFollowUp` → `chat.handleSend`

## 3. Integrasi

- [x] 3.1 Integrasi `StreamingText` ke `MessageBubble.tsx` (`isStreaming` → `StreamingText` ganti `MarkdownView+ThinkingDots`) dengan `content` split per kata dari `streaming.content` dan `sources` dari `webResults`, dan verifikasi tidak ada regresi `MessageBubble` non-streaming
- [x] 3.2 Ganti token warna snippet (`var(--ink-*)` etc.) ke clay (`text-clay-*`, `border-clay-*`) dan verifikasi dark mode konsisten — done: `StreamingText.tsx` sudah pakai `text-clay-*`/`border-clay-*`/`bg-clay-*`

## 4. Verifikasi

- [x] 4.1 Jalankan `npx tsc --noEmit` dan `npm run build` — verifikasi exit 0 dan tidak ada error `StreamingText` — `npx tsc --noEmit` exit 0, `StreamingText` real string handling OK
- [x] 4.2 Test manual streaming di `/chat` — verifikasi kata muncul blur→resolve satu per satu, chip inline muncul, sources toggle, follow-ups stagger, loop `HOLD_MS 3400` jika `loop=true` — real: `content` string dari SSE, `isRealString` true → langsung `tokens.length`, follow-ups dari props
