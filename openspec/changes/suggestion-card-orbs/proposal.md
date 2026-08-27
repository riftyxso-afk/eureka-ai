## Why

Landing Dashboard kini hanya menampilkan dua kartu saran ("Tanya Apa Saja" dan "Kerjakan Tugas") yang mengisi composer—tanpa umpan balik visual saat proses dimulai. Pengguna menunggu tanpa tahu skill apa yang dipakai (analogi vs langkah-demi-langkah) dan thinking-orbs yang sudah terpasang belum terlihat di konteks kartu tersebut.

## What Changes

- Kartu **Tanya Apa Saja** mendapat loading/skill terintegrasi: saat diklik, ikon/area kartu menampilkan orb `thinking` → `composing` dan label skill "Menjelaskan dengan analogi..." langsung di dalam kartu sebelum prompt terkirim ke composer.
- Kartu **Kerjakan Tugas** mendapat loading/skill terintegrasi: saat diklik, kartu menampilkan orb `working`/`solving` dan label skill "Menyusun langkah penyelesaian..." di dalam kartu.
- Masing-masing kartu menyimpan `loading` state lokal sehingga umpan balik terlihat tanpa navigasi; setelah 300-500ms prompt diisi ke composer (perilaku saat ini dipertahankan) namun orb tetap visible hingga composer focus.
- Menggunakan wrapper `EurekaOrb` yang sudah ada (memetakan ke `thinking-orbs` states: `composing`, `working`, `solving`) tanpa menambah dependency baru.
- Tidak menambah kartu baru atau mengubah routing; hanya memperkaya dua kartu yang ada.

## Capabilities

### New Capabilities
- `suggestion-card-orbs`: kartu saran Dashboard menampilkan orb dan label skill yang sesuai langsung di dalam kartu saat di-interaksi, sebelum dan sesaat setelah mengisi composer.

### Modified Capabilities
- `dashboard-hub`: memperluas perilaku kartu saran dari sekadar mengisi composer menjadi menampilkan feedback skill/loading terintegrasi di dalam kartu.

## Impact

- **Kode**: `components/dashboard/AssistantHub.tsx` (dua kartu saran), `components/ui/EurekaOrb.tsx` (reuse), `app/dashboard/page.tsx` tidak berubah.
- **Dependencies**: tidak ada tambahan (reuse `thinking-orbs`).
- **UX**: klik kartu tidak lagi terasa diam; user melihat skill yang akan dipakai sebelum mengetik.
