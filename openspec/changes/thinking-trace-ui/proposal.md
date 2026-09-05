## Why

Chat AI Eureka saat ini hanya menampilkan orb `thinking` generik tanpa rincian langkah; pengguna tidak tahu apakah AI sedang membaca brief, mencari web, atau menjalankan tools. Trace yang expandable dengan 4 varian (Steps/Reasoning/Search/Coding) memberi transparansi proses, mengurangi persepsi loading lama, dan konsisten dengan pola `EurekaOrb` yang sudah ada.

## What Changes

- Tambah komponen `components/thinking/ThinkingState.tsx` (dari snippet) sebagai `ThinkingTrace` yang mendukung 4 varian: `Steps` (step list + spinner→check), `Reasoning` (prose), `Search` (query + domain links + Dot tones), `Coding` (file read/edit/run + diff add/del).
- Integrasi ke `MessageBubble`/`WebSearchPipeline`/`ChatSkeleton`: saat `isStreaming` atau `webStage==="searching"` tampilkan `ThinkingState` yang sesuai (Steps untuk pipeline umum, Search untuk `webSearch`, Coding untuk tool calls), auto-expand 1→4 lalu settled tetap expandable via `manualExpanded`.
- Pertahankan API `variant` + `onSettled` untuk embedder yang perlu sekuens konten setelah trace selesai (mis. `minHeight` 176 saat working/expanded).
- Tidak ada breaking change API chat; hanya penambahan UI.

## Capabilities

### New Capabilities
- `thinking-trace`: Trace berpikir AI yang expandable dengan 4 varian (Steps, Reasoning, Search, Coding), state `working`/`settled`, animasi shimmer/spin/fade-up, dan interaksi link/button di row.

### Modified Capabilities
- (none) — reuse `EurekaOrb` variant `thinking`/`searching` yang sudah ada; tidak ubah requirement spec lain.

## Impact

- **Code**: Baru `components/thinking/ThinkingState.tsx` (atau `components/asisten/ThinkingState.tsx`), modifikasi ringan `MessageBubble.tsx`, `WebSearchPipeline.tsx` (ganti `ThinkingDots` → `ThinkingState` untuk varian yang cocok), `app/globals.css` (keyframes `shimmer-text`, `fade-in`, `fade-up`, `spin` jika belum ada).
- **Dependencies**: `framer-motion` sudah ada; tidak tambah deps baru.
- **System**: Tidak ada perubahan API/DB; SSR-safe (`useEffect`/`useLayoutEffect` untuk sequencer).
