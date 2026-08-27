# Design: Thinking Orbs and AI Avatar

## Context

- `thinking-orbs@0.3.1`: `<ThinkingOrb state size theme>` — 9 state, dua preset ukuran (64/20), canvas 2D monokrom, deteksi tema otomatis membaca class `.dark` ancestor via MutationObserver → kompatibel langsung dengan `ThemeContext` aplikasi ini.
- Titik loading existing: `MessageBubble.tsx` (`ThinkingDots` + "Eureka sedang berpikir…"), `WebSearchPipeline.tsx`, `CreateNoteModal.tsx`, `NoteAIChat.tsx`, `ChapterAIChat.tsx`, `ChatSkeleton.tsx`.
- Avatar AI: `MessageBubble.tsx:167-172` merender `/logo.png` 32px di samping bubble respons.
- Sistem tema: token clay via CSS variable + class `.dark` di `<html>`; reduced motion belum ada util global.

## Goals / Non-Goals

**Goals:**
- Satu pembungkus tipis agar pemetaan state terpusat dan type-safe.
- Port SVG blob ke komponen React dengan animasi ter-isolasi & reduced-motion.
- Sentuhan minimal pada tiap titik loading (ganti elemen indikator, tanpa refactor alur).

**Non-Goals:**
- Mengubah logika streaming/pipeline/web search — hanya lapisan visual indikatornya.
- Mengganti logo di tempat non-chat (navbar, landing, favicon).
- Membuat state orb baru di luar 9 state pustaka.

## Decisions

### D1 — Wrapper `components/ui/EurekaOrb.tsx`
Ekspor komponen tipis dengan props semantik: `variant: "thinking" | "searching" | "working" | "connecting"` dan `scale: "inline" | "avatar"` (memetakan ke size 20/64), plus `theme="auto"` tetap. Alasan: pemetaan konteks→state hidup di SATU tempat; pemanggil tidak menyentuh string pustaka mentah. Alternatif (pakai `ThinkingOrb` langsung di tiap file) ditolak: rawan inkonsisten.

### D2 — Pemetaan konteks → state
thinking (bubble streaming/kosong, NoteAIChat, ChapterAIChat) · searching (WebSearchPipeline) · working (CreateNoteModal proses, overlay progres catatan bila memakai indikator teks) · connecting (ChatSkeleton muat sesi). State lain dari pustaka (solving/weaving/composing/breathing/shaping) TIDAK dipakai dulu — cadangan evolusi. Alternatif memakai `weaving` untuk membuat catatan ditolak: makna kurang umum dipahami siswa dibanding `working`.

### D3 — Avatar: port SVG ke `components/asisten/EurekaBlobAvatar.tsx`
Markup SVG yang diberikan pengguna di-port apa adanya (viewBox −125 −125 250 250, mask bulat, rect ungu `#8b5cf6`) DENGAN tiga penyesuaian wajib:
1. **Isolasi gaya**: kelas `.oeil0/.oeil1` & keyframes diganti nama berprefiks (`eureka-blob-eye-a/b`, keyframes di `app/globals.css` bagian baru) — `<style>` bawaan SVG bersifat global dan akan bocor/duplikat per-instance.
2. **Reduced motion**: blok `@media (prefers-reduced-motion: reduce)` membekukan kedua mata pada pose netral (transform none).
3. **Ukuran**: default 32×32 (slot logo lama), prop `size` opsional.
Alternatif (gif/lottie) ditolak: berat & sulit mengikuti tema.

### D4 — Pemasangan avatar
Ganti elemen `<img src="/logo.png">` pada cabang respons asisten `MessageBubble.tsx` dengan `<EurekaBlobAvatar size={32}/>`. Bubble pengguna & area lain tidak disentuh. Alt text → `aria-label="Eureka.AI"` pada role img.

## Risks / Trade-offs

- [Keyframes duplikat bila komponen dirender banyak] → keyframes cukup didefinisi sekali di globals.css; komponen hanya memakai class.
- [Canvas orbs menambah pekerjaan per-frame] → pustaka plain-canvas ringan, indikator muncul sesaat saat loading saja; reduced motion mematikan loop.
- [Perbedaan visual orb vs claymorphism] → orb monokrom mengikuti tinta tema; dipasang sebagai elemen status fungsional, bukan dekorasi.

## Migration Plan

Deploy front-end biasa; tanpa migrasi data. Rollback = revert commit (dep + file komponen).

## Open Questions

- Tidak ada.
