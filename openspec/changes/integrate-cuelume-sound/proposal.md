## Why

Eureka.AI saat ini pakai Web Audio API manual (`lib/notifySound.ts`) untuk 3 nada sintetis (ding-dong, fanfare, level-up). User minta `npm install cuelume` dan sesuaikan dengan sound Eureka — supaya sound lebih kaya, konsisten, mudah di-maintain, dan bisa dipakai lintas fitur (catatan selesai, onboarding, level-up, chat) tanpa duplikasi `AudioContext` unlock logic.

## What Changes

- Install dependency `cuelume` via `npm install cuelume` dan tambah ke `package.json` + `package-lock.json`.
- Buat adapter `lib/sound/cuelume.ts` (atau `lib/cuelume.ts`) yang wrap `cuelume` untuk init, unlock (gestur `pointerdown`/`touchend` untuk iOS), dan expose API Eureka yang sama: `playCompletionSound()`, `playCelebrationSound()`, `playLevelUpSound()` dengan timbre/durasi yang preservasi karakter Eureka (E5→A5 ding-dong, C-E-G-C fanfare, dll).
- Refactor `lib/notifySound.ts` untuk delegasi ke adapter cuelume (atau re-export) — jaga backward compatibility agar pemanggilan existing di `CreateNoteModal`, `learning-celebrations`, `studyTools` tidak berubah.
- Tambah preferensi `soundEnabled` (opsional, default on) dan hormati `prefers-reduced-motion`/`prefers-reduced-sound` jika ada.
- Pastikan tidak ada breaking change API publik; hanya internal audio engine berganti.

## Capabilities

### New Capabilities
- `eureka-sound`: Sistem suara terpusat Eureka — inisialisasi cuelume, unlock audio di gestur pertama, dan memainkan 3+ cue Eureka (completion, celebration, level-up) dengan karakteristik nada yang konsisten. Spec ini menjadi source of truth untuk semua feedback audio.

### Modified Capabilities
- (none) — `learning-celebrations` dan `notes` tetap pakai API yang sama; perubahan hanya implementasi di balik `lib/notifySound.ts`.

## Impact

- **Code**: `package.json`, `lib/notifySound.ts`, `lib/sound/cuelume.ts` (baru), `components/dashboard/CreateNoteModal.tsx`, `lib/learning-celebrations` (jika ada), `app` mana pun yang import sound.
- **Dependencies**: tambah `cuelume` (npm). Tidak ada penambahan backend/env.
- **System**: Audio tetap optional (fail silent), unlock tetap via gestur pertama, tidak butuh file aset eksternal kecuali cuelume butuhkan.
- **Risiko**: Jika `cuelume` tidak ada di npm / API berbeda, fallback ke Web Audio lama (graceful degrade).
