# Design: note-loading-live-steps

## Context

Pipeline catatan sudah mengemisikan kemajuan granular: `ProgressTracker` (`lib/progressTracker.ts`) menerbitkan `ProgressEvent {phase, percent, message, timestamp}` dari 5 fase (`extract → chapters → enrichment → rag → study_tools`), termasuk sub-kemampuan per bagian via `PhaseProgressFn`. Event ditampung in-memory per sesi lalu dialirkan SSE oleh `app/api/notes/process-progress/[sessionId]/route.ts` (poll 400ms, replay semua event sejak awal sesi). Dua konsumen: `NoteProgressOverlay` (dari chat) dan `CreateNoteModal` (dashboard) — keduanya hanya menampilkan persen + satu pesan. Referensi visual dari user: komponen "ToolChips" (baris langkah dengan chip inline, expandable, header collapsible) — tapi referensi memakai data mock + timer, dan palet netral (`ink-*`, `hover-2`, …) yang tidak ada di tema clay Eureka.

## Goals / Non-Goals

**Goals:**
- User melihat langkah-langkah NYATA yang dikerjakan AI (dari event SSE), muncul real-time, expandable, collapsible.
- Satu komponen daftar langkah yang dipakai kedua konsumen; event SSE tetap backward-compatible.
- Label & detail bahasa Indonesia.

**Non-Goals:**
- Mengubah urutan/isi pipeline catatan, job queue, atau persen-fase (`PHASES`).
- Bagian "file-diff chips" dan tombol "+2 more" dari referensi (tidak relevan untuk catatan).
- Streaming teks hasil AI; hanya status langkah.

## Decisions

### D1 — Info step sebagai field opsional pada ProgressEvent (aditif)
`ProgressEvent` mendapat `step?: { id: string; label: string; detail?: string; icon?: string; status: "active" | "done" }`. Event lama tetap valid; klien lama mengabaikan field baru.
**Alternatif ditolak:** tipe event baru / jalur SSE terpisah — memecah stream dan menambah kompleksitas konsumen tanpa manfaat.

### D2 — Granularitas: 1 baris per fase, detail aktif diperbarui
Lima baris langkah sesuai fase (ikon: extract=Download, chapters=PenLine, enrichment=Globe, rag=Database, study_tools=Layers — semua lucide, sudah ada di dependency). Sub-kemampuan (`PhaseProgressFn`, mis. "Bab 2/4") TIDAK menambah baris baru; ia memperbarui `detail` baris fase aktif + persen. Daftar maksimal 5 baris → ringkas, tidak bising.
**Alternatif ditolak:** baris per bab/kuis — sampai 20+ baris untuk 6 bab, membebani UI dan SSE.

### D3 — Emisi step di lapisan proses
`app/api/notes/process/route.ts` membungkus reporter yang ada: saat fase mulai → `step {status:"active"}`; saat fase selesai → `step {status:"done"}`; label sub-fase dari pipeline menjadi `detail` baris aktif. Emisi via `ProgressTracker` yang sudah ada — tidak ada store baru.

### D4 — Komponen `NoteLoadingSteps` + hook `useNoteSteps`
Komponen menerima daftar step (dari state hook) dan murni presentasi: baris muncul saat event tiba (animasi fade-up), baris aktif berdenyut halus, baris selesai ceklis; tiap baris expandable; header collapsible — pola interaksi dari referensi dipertahankan, tapi timer `STEP_MS` DIBUANG (kemunculan hanya dari event SSE). Visual memakai kelas clay yang sudah ada (`rounded-clay-*`, `bg-clay-cream`, `text-clay-*`), bukan token netral referensi.
Kedua konsumen memakai hook yang sama untuk mengubah event SSE → state langkah (Map id → step, urutan kedatangan).

### D5 — Reconnect aman via replay
Route SSE sudah memutar ulang semua event sesi sejak awal bagi klien baru → setelah putus-sambung, klien membangun ulang state langkah dari replay event (tidak ada langkah selesai yang hilang). Hook `useNoteSteps` dirancang idempoten terhadap event berulang (update by id).

## Risks / Trade-offs

- [Event sub-fase frekuensi tinggi (per bab) membuat UI berkedip] → sub-fase hanya mengubah teks detail baris aktif, tidak menambah/mengubah baris; throttle render bila perlu.
- [Kelas Tailwind referensi tidak ada di tema Eureka] → adaptasi penuh ke palet clay; verifikasi visual manual di kedua konsumen.
- [Store progress in-memory (tidak lintas instance)] → keterbatasan existing SSE tracker; change ini tidak memperburuk dan tidak memperbaiki (di luar scope).
- [Dua konsumen harus tetap konsisten] → satu hook + satu komponen dipakai keduanya; tes di kedua jalur (chat & dashboard).

## Migration Plan

Perubahan aditif: deploy biasa tanpa migrasi data. Rollback = revert commit.

## Open Questions

(none — asumsi minor dicatat di proposal: estetika chip diadaptasi ke tema clay, langkah didorong event SSE nyata.)
