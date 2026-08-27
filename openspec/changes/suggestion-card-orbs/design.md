## Context

AssistantHub saat ini merender dua kartu saran sebagai button statis yang langsung mengisi `composerPrefill` dan me-remount Composer. Wrapper `EurekaOrb` sudah ada dan dipakai di MessageBubble, NoteAIChat, WebSearchPipeline, dll., memetakan variant semantik `thinking`→`composing` dan `working`→`working`. Kartu saran belum memiliki state visual loading.

## Goals / Non-Goals

**Goals:**
- Tampilkan orb dan label skill di dalam kartu yang diklik, tanpa menambah halaman atau navigasi.
- Pertahankan perilaku mengisi composer yang ada; orb hanya menambah feedback.
- Hormati `prefers-reduced-motion`.

**Non-Goals:**
- Menambah kartu baru atau mengubah prompt yang dikirim.
- Mengubah Composer atau logika `launchChat`; hanya card UI.
- Membuat wrapper orb baru — reuse `EurekaOrb`.

## Decisions

- **State lokal per kartu**: Dua state `loadingCard: "tanya" | "tugas" | null` di AssistantHub. Saat klik, set state → render orb inline menggantikan ikon statis, dan deskripsi diganti teks skill ("Menjelaskan dengan analogi..." / "Menyusun langkah penyelesaian..."). Setelah 400ms, kembalikan ke state normal. Alternatif global store ditolak karena hanya perlu lokal.

- **Pemetaan skill → orb**: "Tanya Apa Saja" → `variant="thinking"` (wrapper memetakan ke `composing`), "Kerjakan Tugas" → `variant="working"`. Alternatif `solving` untuk tugas dipertimbangkan tetapi `working` lebih konsisten dengan CreateNoteModal.

- **Reduced motion**: EurekaOrb sudah menangani; kartu hanya mengganti ikon dengan orb sehingga fallback statis otomatis.

- **Tidak memblokir composer**: Orb di kartu bersifat visual saja; `setComposerPrefill` tetap dipanggil segera (0ms) terpisah dari timer reset card, sehingga user bisa langsung edit prompt.

## Risks / Trade-offs

- [Klik ganda cepat] → Mitigasi: guard `if (loadingCard) return` dan debounce 300ms sebelum reset.
- [Layout shift saat ikon diganti orb] → Mitigasi: orb inline berukuran 20px sama dengan ikon 18px + padding, container tetap flex dengan ukuran tetap.

## Migration Plan

- Perubahan purely frontend di `AssistantHub.tsx`; tidak ada migrasi data. Rollback: revert komponen.

## Open Questions

- Tidak ada.
