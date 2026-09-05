## Context

`MessageBubble` saat ini pakai `EurekaOrb variant="thinking"` generik; `WebSearchPipeline` sudah punya 3-step pipeline tapi belum reuse trace yang expandable. Snippet `ThinkingState` yang diberikan oleh user adalah implementasi referensi yang harus diadaptasi ke design system Eureka (clay) dan diintegrasikan tanpa mengubah API chat. Lihat `proposal.md - Why`.

## Goals / Non-Goals

**Goals:**
- Satu komponen `ThinkingState` reusable untuk 4 varian dengan sequencer `STAGES=[800,600,1800,2600,1600]` dan `useSequence`.
- Integrasi mulus ke `MessageBubble` (saat `isStreaming`) dan `WebSearchPipeline` (saat `webStage==="searching"`), dengan `minHeight` 176 agar layout tidak lompat.
- Aksesibilitas `aria-expanded`/`role="status"` dan animasi yang sudah ada (`shimmer-text`, `fade-up`) dipetakan ke token clay.

**Non-Goals:**
- Tidak menambah API/DB baru; hanya UI.
- Tidak mengubah `EurekaOrb` atau `WebSearchPipeline` API breaking.
- Tidak menambah dependency baru selain `framer-motion` yang sudah ada.

## Decisions

**1. Lokasi komponen `components/thinking/ThinkingState.tsx` vs `components/asisten/ThinkingState.tsx`**
- **Keputusan**: `components/thinking/ThinkingState.tsx` baru, di-import sebagai `ThinkingTrace` di `MessageBubble`/`WebSearchPipeline`. Biarkan `ThinkingDots` lama sebagai fallback untuk `variant` yang tidak dikenal.
- **Alternatif**: Timpa `EurekaOrb` — ditolak, `EurekaOrb` dipakai di banyak tempat dengan skala berbeda.
- **Rationale**: Isolasi, mudah di-test, tidak pecah existing.

**2. Adaptasi styling dari snippet (var(--ink-3) etc.) ke clay**
- **Keputusan**: Ganti `var(--ink-*)`/`var(--line)`/`bg-accent` dengan token clay (`text-clay-muted`, `border-clay-borderLight`, `bg-clay-primary/10`). Pertahankan `framer-motion` untuk `grid-template-rows` dan `shimmer-text` keyframes, tapi sesuaikan warna.
- **Alternatif**: Copy-paste snippet apa adanya — ditolak, tidak konsisten dengan tema.
- **Rationale**: Konsistensi visual, dark mode clay tetap jalan.

**3. Sequencer `useSequence(STAGES)`**
- **Keputusan**: Pertahankan `STAGES` asli untuk demo; di integrasi real, `stage` akan di-drive oleh `isStreaming`/`webStage` (mis. `stage 0` saat `isStreaming` true, `stage 3` saat `!isStreaming`), bukan timer internal. `onSettled` tetap dipakai untuk `minHeight` lock.
- **Alternatif**: Selalu pakai timer internal — ditolak, tidak sinkron dengan SSE.
- **Rationale**: Fleksibilitas: komponen bisa dipakai standalone (demo) maupun controlled.

## Risks / Trade-offs

- **Snippet pakai `var(--ink-3)` yang tidak ada di clay** → Mitigasi: mapping manual ke `var(--clay-muted)` saat adaptasi.
- **`useLayoutEffect` untuk `lineHeight` bisa 0 saat collapsed** → Mitigasi: fallback `height: lineHeight ? lineHeight-2 : 0` sudah ada, tidak block render.
- **Banyak animasi `framer-motion` di bubble bisa jank di low-end** → Mitigasi: `stagger 120ms` tetap, tapi `motion` hanya untuk trace yang visible, tidak untuk setiap bubble.

## Migration Plan

1. Tambah `components/thinking/ThinkingState.tsx` (adaptasi snippet), tambah keyframes `shimmer-text`/`fade-up` ke `app/globals.css` jika belum ada.
2. Update `MessageBubble.tsx`/`WebSearchPipeline.tsx` untuk render `ThinkingState` sesuai `variant` (Steps untuk umum, Search untuk `webSearch`), `npm run build` + `npx tsc --noEmit` 0.
3. Rollback: hapus import `ThinkingState`, kembalikan `ThinkingDots`/`EurekaOrb` — tidak ada migrasi DB.

## Open Questions

- Apakah `Search` variant perlu `+7 more` dinamis dari `webResults.length` atau hardcode `+7 more` seperti snippet? — Ditunda, default hardcode sesuai snippet, follow-up bisa dinamis.
