## 1. Setup

- [x] 1.1 Buat `components/thinking/ThinkingState.tsx` dari snippet (adaptasi token clay, `framer-motion` tetap) dan verifikasi file ada di repo
- [x] 1.2 Tambah keyframes `shimmer-text`, `fade-in`, `fade-up`, `spin` ke `app/globals.css` jika belum ada dan verifikasi `npx tsc --noEmit` 0

## 2. Core Implementation

- [x] 2.1 Implementasi varian `Steps`/`Reasoning` — step list dengan spinner→check, prose reasoning, dan verifikasi `variant="Steps"` render 4 row dengan animasi `fade-up 120ms`
- [x] 2.2 Implementasi varian `Search` — query `best waffle cone supplier` + 3 source links (`Joy Cone` etc.) dengan `Dot` tone dan `+7 more`, dan verifikasi link `target="_blank"`
- [x] 2.3 Implementasi varian `Coding` — rows `Read`/`Edit`/`Run` dengan `mono` dan `+74 −41`, toggle `selectedTool` dan verifikasi `aria-pressed`
- [x] 2.4 Implementasi header expandable (`aria-expanded`, `shimmer` saat `working`, `Thought for 4 seconds` saat settled, `minHeight` 176) dan `useSequence(STAGES)` + `onSettled` dan verifikasi toggle manual bekerja

## 3. Integrasi

- [x] 3.1 Integrasi `ThinkingState` ke `MessageBubble.tsx` (`isStreaming` → `Steps`) dan `WebSearchPipeline.tsx` (`webStage==="searching"` → `Search`) dan verifikasi tidak ada regresi `ThinkingDots`
- [x] 3.2 Ganti token warna snippet (`var(--ink-3)` etc.) ke clay (`text-clay-muted`, `border-clay-borderLight`) dan verifikasi dark mode tetap konsisten

## 4. Verifikasi

- [x] 4.1 Jalankan `npx tsc --noEmit` dan `npm run build` — verifikasi exit 0 dan tidak ada error `ThinkingState`
- [x] 4.2 Test manual 4 varian di Storybook/halaman demo — verifikasi `working` shimmer, `settled` fade-in, expand/collapse, link/button interaktif
