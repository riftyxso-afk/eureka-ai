# Proposal: Thinking Orbs and AI Avatar

## Why

Seluruh indikator loading di pengalaman asisten & pembuatan catatan masih berupa titik-titik generik (`ThinkingDots`) dan teks statis — tidak mengekspresikan apa yang sedang dikerjakan AI (berpikir, mencari web, memproses catatan). Di saat yang sama, avatar di samping bubble respons AI masih logo statis. Pengguna ingin bahasa loading yang hidup dan konsisten: paket `thinking-orbs` (9 state animasi canvas, auto dark/light) diterapkan sesuai konteks masing-masing, dan logo di samping bubble respons AI diganti avatar blob animasi.

## What Changes

- **Dep baru**: `npm install thinking-orbs` — komponen `<ThinkingOrb state size theme>` berbasis canvas 2D, tanpa WebGL, mendukung deteksi tema otomatis (kompatibel dengan class `.dark` aplikasi ini).
- **Sistem pemetaan loading → state orb** diterapkan lintas permukaan:
  - Berpikir / streaming jawaban (`MessageBubble`, `NoteAIChat`, `ChapterAIChat`) → `composing`
  - Pipeline pencarian web (`WebSearchPipeline`) → `searching`
  - Memproses / membuat catatan (`CreateNoteModal`, overlay progres catatan) → `working`
  - Memuat sesi percakapan (`ChatSkeleton`) → `connecting`
- Dua ukuran resmi sesuai preset pustaka: 64 (skala avatar) & 20 (inline teks); tema `auto`.
- **Avatar AI baru**: logo `/logo.png` di samping bubble respons asisten (`MessageBubble.tsx`) diganti komponen avatar blob animasi (SVG + dua "mata" beranimasi) sesuai spesifikasi visual yang diberikan pengguna.
- Animasi menghormati `prefers-reduced-motion` (orb & avatar turun ke versi statis).

## Capabilities

### New Capabilities
- `orb-loading-system`: aturan pemetaan konteks loading → state orb ThinkingOrb di seluruh permukaan asisten & catatan, termasuk aturan ukuran, tema, dan aksesibilitas.
- `ai-avatar`: identitas visual asisten pada percakapan — avatar blob beranimasi yang menggantikan logo statis di samping setiap respons AI.

### Modified Capabilities
<!-- Tidak ada: spec chat-loading existing mengatur skeleton muat-riwayat (perhatian berbeda dari orb status aktif); tidak diubah. -->

## Impact

- **Kode**: `package.json` (+dep), komponen baru `components/ui/EurekaOrb.tsx` & `components/asisten/EurekaBlobAvatar.tsx`, sentuhan pada `MessageBubble.tsx`, `WebSearchPipeline.tsx`, `CreateNoteModal.tsx`, `NoteAIChat.tsx`, `ChapterAIChat.tsx`, `ChatSkeleton.tsx`; keyframes CSS avatar di `app/globals.css`.
- **Bundle**: +1 dep ringan (canvas 2D, tanpa WebGL).
- **Risiko**: kelas CSS animasi mata harus di-namespaced agar tidak bentrok global; reduced motion wajib dihormati.
- Tidak ada perubahan API/backend/database.
