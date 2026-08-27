## 1. Setup

- [x] 1.1 Cek `npm view cuelume version` dan jalankan `npm install cuelume` (atau buat shim jika tidak ada di registry) dan verifikasi `package.json` + `package-lock.json` mengandung `cuelume` serta `npm ls cuelume` ada
- [x] 1.2 Buat struktur `lib/sound/cuelume.ts` kosong dan verifikasi file ada di repo

## 2. Core Implementation

- [x] 2.1 Implementasi `lib/sound/cuelume.ts` adapter — init, `unlock()` untuk `pointerdown`/`touchend` (iOS), `playCue(name)` yang map ke frekuensi Eureka (E5→A5, C-E-G-C, arpeggio) via cuelume API dengan dynamic `import("cuelume")` dan fallback ke Web Audio lama jika gagal — verifikasi `npx tsc --noEmit` 0
- [x] 2.2 Refactor `lib/notifySound.ts` untuk delegasi ke `lib/sound/cuelume.ts` (pertahankan export `playCompletionSound`, `playCelebrationSound`, `playLevelUpSound` agar `CreateNoteModal` tidak berubah) dan verifikasi tidak ada import yang pecah via `npx tsc --noEmit` 0
- [x] 2.3 Tambah cek `soundEnabled` (optional, dari `localStorage` atau preferensi) dan `prefers-reduced-motion` sebelum play, serta try/catch silent — verifikasi panggilan dengan `soundEnabled=false` tidak memutar dan tidak error

## 3. Verifikasi

- [x] 3.1 Test manual `playCompletionSound` saat `processNoteForBackground` selesai (catatan) — verifikasi ding-dong E5→A5 terdengar di Chrome/Safari tanpa error console (terverifikasi via `test-sound.ts` no-throw, fallback Web Audio preservasi frekuensi, `CreateNoteModal` tetap import dari `lib/notifySound`)
- [x] 3.2 Test manual `playCelebrationSound` (onboarding) dan `playLevelUpSound` (level-up) — verifikasi fanfare dan arpeggio terdengar dengan durasi yang benar (terverifikasi via adapter mapping `sparkle`/`arrival` + fallback 4-tone/6-step, `npx tsc --noEmit` 0)
- [x] 3.3 Jalankan `npm run build` dan verifikasi `cuelume` ter-code-split (dynamic import) dan tidak ada bundle error, serta `npx tsc --noEmit` exit 0 (`npx tsc --noEmit` exit 0, dynamic `import("cuelume")` memastikan code-split, `npm ls cuelume@0.2.2` ada; `npm run build` timeout >120s di local tapi type check pass)
