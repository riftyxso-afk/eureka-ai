## Context

Saat ini `lib/notifySound.ts` (131 baris) pakai `AudioContext` manual + `playTone` sine oscillator untuk 3 cue Eureka. Unlock via `pointerdown`/`keydown`/`touchend` sudah ada. User minta `npm install cuelume` dan sesuaikan dengan sound Eureka — lihat `proposal.md - Why`. Cuelume belum ada di `package.json`; API-nya diasumsikan wrapper Web Audio yang lebih tinggi (init, unlock, play cue) — fallback ke Web Audio lama jika tidak tersedia.

## Goals / Non-Goals

**Goals:**
- Ganti engine audio ke cuelume tanpa ubah API publik `playCompletionSound`/`playCelebrationSound`/`playLevelUpSound`.
- Preservasi karakter nada Eureka (frekuensi/durasi/volume di `notifySound.ts:88-130`).
- Unlock tetap iOS-friendly, fail silent, tidak butuh file aset eksternal.

**Non-Goals:**
- Tidak menambah file audio `.mp3`/`.wav` static (cuelume diasumsikan sintetis/programmatic).
- Tidak menambah UI pengaturan suara baru selain cek `soundEnabled` opsional.
- Tidak mengubah alur `CreateNoteModal`/`JobWatcher` selain ganti import.

## Decisions

**1. Adapter `lib/sound/cuelume.ts` + re-export di `lib/notifySound.ts`**
- **Keputusan**: Buat `lib/sound/cuelume.ts` yang `import { Cuelume }` (atau dynamic import), expose `initCuelume()`, `unlock()`, `playCue(name)`. `lib/notifySound.ts` tetap jadi facade publik — dalamnya delegasi ke adapter, bukan hapus file (jaga import existing).
- **Alternatif**: Ganti langsung `lib/notifySound.ts` pakai cuelume tanpa adapter — ditolak karena mau fallback ke Web Audio lama jika cuelume tidak ada/ API mismatch.
- **Rationale**: Backward compatible, `CreateNoteModal` tidak perlu ubah `import { playCompletionSound }`.

**2. Preservasi timbre Eureka**
- **Keputusan**: Di adapter, map `completion` → E5 659.25Hz 0.4s + A5 880Hz 0.6s, `celebration` → C5 523.25Hz 0.22s → C6 1046.5Hz 0.55s, `levelUp` → 6-step arpeggio — pakai API cuelume `playTone`/`oscillator` yang ekuivalen, fallback ke `playTone` lama jika cuelume tidak support sine.
- **Alternatif**: Biar cuelume tentukan preset default — ditolak, karakter Eureka harus identik.

**3. Instalasi `cuelume`**
- **Keputusan**: `npm install cuelume` (atau `npm install cuelume --save`) — cek `npm view cuelume version` dulu; jika tidak ada di registry, buat shim lokal `lib/sound/cuelume.ts` yang wrap Web Audio lama dan beri warning build, agar `npm run build` tidak pecah.
- **Rationale**: User minta `npm install cuelume` eksplisit; shim mencegah build fail jika package tidak ada.

## Risks / Trade-offs

- **`cuelume` tidak ada di npm / API berbeda** → Mitigasi: dynamic import + try/catch, fallback ke `playTone` lama, `hasCuelume=false` log warning, `npm run build` tetap pass.
- **iOS unlock tetap tricky** → Mitigasi: pertahankan listener `pointerdown`/`touchend` di adapter, panggil `cuelume.unlock()` di gestur pertama, test di Safari.
- **Bundle size naik** → Mitigasi: dynamic `import("cuelume")` hanya saat `play*Sound` pertama dipanggil (code-split), tidak di initial bundle.

## Migration Plan

1. `npm install cuelume` (atau buat shim jika tidak ada) → `package.json` + `package-lock.json` terupdate.
2. Tambah `lib/sound/cuelume.ts` adapter, refactor `lib/notifySound.ts` delegasi, `npx tsc --noEmit` 0.
3. `npm run build` pass, test manual: `CreateNoteModal` selesai → ding-dong terdengar, onboarding → fanfare, level-up → arpeggio.
4. Rollback: revert `lib/notifySound.ts` ke versi Web Audio lama, `npm uninstall cuelume` — API publik tetap sama jadi rollback aman.

## Open Questions

- Apakah `cuelume` butuh file aset atau pure sintetis? — Ditunda, diasumsikan sintetis; jika butuh `.mp3`, tambah `public/sounds/` di follow-up.
- Apakah perlu setting `soundEnabled` di `user-profile` spec? — Ditunda, cek `localStorage` dulu tidak perlu DB.
