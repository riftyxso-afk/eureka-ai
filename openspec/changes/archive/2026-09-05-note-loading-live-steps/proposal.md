# Proposal: note-loading-live-steps

## Why

Saat membuat catatan, user hanya melihat progress bar 0–100% dan satu pesan pendek ("Menyiapkan materi…", dst.) selama ber menit-menit — mereka tidak tahu apa yang sedang dikerjakan AI (mengekstrak materi? menyusun bab? mencari fakta di web? membuat kuis?). Akibatnya proses terasa lama dan misterius. Backend sebenarnya sudah punya data yang dibutuhkan: pipeline catatan mengemisikan event fase+label granular lewat `ProgressTracker` → SSE `/api/notes/process-progress/[sessionId]` — hanya UI-nya yang menampilkan persen dan satu pesan saja.

## What Changes

- **Komponen baru `NoteLoadingSteps`** (pola visual "tool chips" dari referensi yang diberikan user): daftar baris langkah yang muncul satu per satu secara real-time — tiap baris punya ikon, label aksi, chip detail, dan bisa di-expand untuk melihat detail langkah. Langkah selesai mendapat tanda ceklis; langkah aktif menampilkan indikator berdenyut. Semua data berasal dari event SSE NYATA (bukan mock/timer).
- **Event SSE diperkaya**: selain `{phase, percent, message}`, pipeline mempublikasikan `step` opsional (`{ id, label, detail?, status: "active"|"done", icon? }`) sehingga klien tahu langkah mana mulai/selesai tanpa menebak dari persen.
- **Update dua konsumen progress** agar menampilkan daftar langkah: `components/note/NoteProgressOverlay.tsx` (overlay dari chat) dan `components/dashboard/CreateNoteModal.tsx` (modal dashboard). Persen & bar progress tetap dipertahankan sebagai rangkuman.
- **Label langkah dalam bahasa Indonesia** mengikuti fase pipeline yang ada: ambil materi (extract), susun bab (chapters), perkaya dengan web (enrichment), siapkan pencarian cerdas/RAG (rag), buat kuis & kartu hafalan (study_tools) — plus sub-langkah granular per bab yang sudah diemisikan pipeline.
- Estetika chip/row diadaptasi ke tema clay Eureka (warna `clay-*` yang ada di Tailwind config), bukan palet netral dari referensi; pola interaksi (hover chevron, expand detail, collapse header) dipertahankan.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `notes`: requirement baru tentang transparansi proses pembuatan catatan — user harus melihat daftar langkah nyata (digerakkan SSE) tentang apa yang sedang dikerjakan AI selama catatan dibuat.

## Impact

- **Kode**: `lib/progressTracker.ts` (tipe event + payload step), `app/api/notes/process/route.ts` & `lib/notesProcessor.ts` (emisi step), `components/note/NoteProgressOverlay.tsx`, `components/dashboard/CreateNoteModal.tsx`, komponen baru `components/note/NoteLoadingSteps.tsx`.
- **Kompatibilitas**: event SSE lama tetap valid — field `step` bersifat aditif; klien lama yang hanya membaca `percent/message` tidak rusak.
- **Tidak terdampak**: job queue, rate limit, premium gating, halaman catatan, RAG.
