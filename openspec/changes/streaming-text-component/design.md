## Context

`MessageBubble` saat ini render `MarkdownView` statis setelah `isStreaming` selesai; tidak ada kata-per-kata blur, chip inline, atau follow-up. Snippet `StreamingText` yang diberikan user adalah implementasi referensi yang harus diadaptasi ke design system clay dan diintegrasikan sebagai pengganti streaming branch di `MessageBubble`. Lihat `proposal.md - Why`.

## Goals / Non-Goals

**Goals:**
- Satu komponen `StreamingText` yang handle word timer (`WORD_MS 55`), `cite` chip, bar aksi, sources expandable, dan follow-ups — dengan `loop`/`fill` props untuk demo vs thread real.
- Integrasi ke `MessageBubble` saat `isStreaming` (ganti `MarkdownView` + `ThinkingDots` dengan `StreamingText` yang diisi `content` dari `streaming.content` split per kata).
- Reuse `EurekaOrb` tidak perlu; `StreamingText` standalone.

**Non-Goals:**
- Tidak mengubah API chat atau `assistant-stream` SSE; hanya UI.
- Tidak menambah DB atau endpoint baru.
- Tidak handle `ThinkingState` di sini — tetap di `MessageBubble` terpisah.

## Decisions

**1. Lokasi komponen `components/streaming/StreamingText.tsx` vs `components/asisten/StreamingText.tsx`**
- **Keputusan**: `components/streaming/StreamingText.tsx` baru, di-import di `MessageBubble` hanya saat `isStreaming`. Biarkan `MarkdownView` untuk `!isStreaming` (jawaban final tetap markdown+KaTeX).
- **Alternatif**: Timpa `MarkdownView` — ditolak, `MarkdownView` butuh KaTeX dan link handling yang `StreamingText` tidak punya.
- **Rationale**: Isolasi, `StreamingText` hanya untuk fase streaming, `MarkdownView` untuk final.

**2. Adaptasi token clay**
- **Keputusan**: Ganti `var(--ink-*)`/`var(--line)`/`bg-accent` di snippet ke `text-clay-*`/`border-clay-*`/`bg-clay-primary` etc., pertahankan `framer-motion` untuk `grid` dan `fade-up`.
- **Alternatif**: Copy paste apa adanya — ditolak, tidak konsisten dark mode clay.

**3. Data mapping `content` vs `streaming.content`**
- **Keputusan**: `streaming.content` (string) di-split `split(" ")` jadi `StreamingToken[]` (`{text}` per kata), sisipkan `cite` token tiap ~8 kata jika `webResults` ada (untuk demo inline chip).
- **Alternatif**: Kirim `StreamingToken[]` dari server — ditolak, server kirim plain `token` text saja.
- **Rationale**: Client-side split cukup untuk demo blur, tidak perlu ubah SSE.

## Risks / Trade-offs

- **Snippet pakai `data:image/svg+xml` inline untuk `SOURCE_IMAGES`** → Mitigasi: pertahankan, tidak butuh fetch, aman SSR.
- **`word` timer `55ms` bisa terlalu cepat untuk jawaban panjang** → Mitigasi: `WORD_MS` tetap 55, tapi `HOLD_MS 3400` memberi jeda sebelum loop; di thread real `loop=false` jadi tidak loop.
- **Follow-up click `onFollowUp` perlu kirim bubble baru** → Mitigasi: `MessageBubble` parent handle `onFollowUp` → `chat.handleSend({question: text})`.

## Migration Plan

1. Tambah `components/streaming/StreamingText.tsx` (adaptasi snippet), tambah keyframes `pop-in` ke `app/globals.css` jika belum ada.
2. Update `MessageBubble.tsx` — branch `isStreaming` render `StreamingText` dengan `content` split, `sources` dari `webResults`, `followUps` statis.
3. `npm run build` + `npx tsc --noEmit` 0.
4. Rollback: hapus import `StreamingText`, kembalikan `MarkdownView` + `ThinkingDots` — tidak ada migrasi DB.

## Open Questions

- Apakah `followUps` perlu dinamis dari AI atau statis 2 seperti snippet? — Ditunda, default statis sesuai snippet, follow-up dinamis bisa di `eureka-skills` nanti.
