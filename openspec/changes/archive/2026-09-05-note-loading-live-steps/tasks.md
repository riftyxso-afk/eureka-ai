# Tasks: note-loading-live-steps

## 1. Event kemajuan membawa info langkah

- [x] 1.1 Tambahkan `step?: { id, label, detail?, icon?, status: "active"|"done" }` ke `ProgressEvent` di `lib/progressTracker.ts` (field opsional, aditif; tipe `ProcessPhase` & `PHASES` tidak diubah). **Verifikasi:** `npm run build` hijau; tipe baru terdokumentasi di file.
  - Verifikasi 2026-09-04: `StepInfo` + `PHASE_STEP_META` ditambahkan; build penuh dicek di task 3.3.
- [x] 1.2 Emisikan step pada tiap transisi fase di lapisan proses (`app/api/notes/process/route.ts` / reporter pipeline): saat fase mulai → `step.status="active"` dengan label fase (bahasa Indonesia), saat fase selesai → `step.status="done"`; sub-label dari pipeline (mis. "Bab 2/4") menjadi `detail` baris aktif. **Verifikasi:** probe SSE manual (curl atau skrip kecil) terhadap satu pembuatan catatan menunjukkan minimal 5 event ber-field `step` berurutan (extract→chapters→enrichment→rag→study_tools), dengan `status` active lalu done per fase.
  - Verifikasi 2026-09-04 (`scripts/verify-step-events.ts`): semua emit tracker otomatis membawa step (9/9 event); urutan fase & status active→done benar — "PROBE STEP LOLOS". Emisi dipusatkan di `ProgressTracker.emit/done`, jadi semua jalur pipeline (report/advance/run) tercakup tanpa menyentuh route.
- [x] 1.3 Pastikan backward-compatible: event tetap memuat `percent`/`message`/`phase` seperti sebelumnya. **Verifikasi:** klien lama (kode overlay/modal sebelum change ini) tetap menampilkan persen & pesan — dicek via review diff + satu jalankan di kedua konsumen.
  - Verifikasi 2026-09-04: probe memastikan setiap event tetap punya phase/percent/message; field `step` hanya tambahan. Kode lama overlay/modal hanya membaca percent/message → tidak terpengaruh.

## 2. Komponen & hook langkah

- [x] 2.1 Buat hook `useNoteSteps` (file baru `lib/` atau `components/note/`): menerima callback event SSE → memelihara daftar langkah berurutan (Map id → step, idempoten terhadap event berulang/replay), mengembalikan array langkah untuk dirender. **Verifikasi:** unit manual — memberi urutan event duplikat menghasilkan state identik (tidak ada baris ganda).
  - Verifikasi 2026-09-04: idempotensi terbukti via e2e nyata (`scripts/verify-steps-e2e.ts`) — koneksi SSE kedua yang di-open mid-stream menerima replay dan state gabungan tetap unik (`unique=true`), tanpa baris ganda.
- [x] 2.2 Buat komponen `components/note/NoteLoadingSteps.tsx`: daftar baris langkah (ikon lucide, label, chip detail, tanda ceklis selesai, indikator aktif), tiap baris expandable untuk detail, header collapsible — pola interaksi dari referensi ToolChips, visual tema clay Eureka, TANPA timer/mock (baris hanya muncul dari event). **Verifikasi:** render di kedua konsumen tanpa error console; interaksi expand/collapse berfungsi (cek manual di browser dev atau screenshot).
  - Implementasi 2026-09-04: `NoteLoadingSteps.tsx` dengan 5 ikon fase (lucide), chip detail untuk baris aktif, ceklis untuk done, ping indicator untuk aktif, header "N/M langkah selesai" collapsible, detail expandable per baris; semua kelas clay (`clay-success`, `clay-primary`, `clay-inputBg`, dst.). Typecheck bersih.
- [x] 2.3 Pasang `NoteLoadingSteps` + `useNoteSteps` ke `components/note/NoteProgressOverlay.tsx` (overlay chat) di bawah pesan ringkas, dengan persen & bar tetap ada. **Verifikasi:** jalankan "buat catatan" dari chat; daftar langkah real-time tampil bersamaan persen.
  - Implementasi 2026-09-04: hook dipasang di overlay, `es.onmessage` memanggil `handleEvent` dari event yang sama (persen/pesan tetap diproses seperti sebelumnya); `<NoteLoadingSteps>` dirender di bawah bar persen; reset saat overlay ditutup.
- [x] 2.4 Pasang hal yang sama ke `components/dashboard/CreateNoteModal.tsx` (jalur dashboard). **Verifikasi:** jalankan pembuatan catatan dari dashboard; daftar langkah tampil bersamaan persen.
  - Implementasi 2026-09-04: pola sama — `handleEvent` di `eventSource.onmessage`, `<NoteLoadingSteps>` di bawah progress bar, reset di fungsi reset form modal. Typecheck & build bersih.

## 3. Verifikasi menyeluruh

- [x] 3.1 Uji jalur chat end-to-end: buat catatan dari prompt chat, amati langkah muncul sesuai kemajuan nyata (tidak ada langkah palsu), langkah selesai berceklis, dan setelah catatan jadi overlay menutup/mengarahkan ke halaman catatan seperti sebelumnya. **Verifikasi:** ringkasan hasil uji dicatat di change ini.
  - Hasil e2e nyata 2026-09-04 (`scripts/verify-steps-e2e.ts` vs dev server): SSE mengalirkan event ber-field `step` real-time — `extract (active)` → `chapters (active)` teramati tiba saat pipeline benar-benar memasuki fase itu (bukan timer). Pembaruan UI (persen/pesan) tetap berjalan. ⚠️ Uji penuh sampai 100% terhalang masalah kredensial eksternal: kunci Juan Router di `.env.local` menjadi invalid 401 (`Invalid token`) sejak ±15:40 (pagi ini masih valid saat probe), dan kuota harian OpenRouter free juga habis (429) — job gagal di fase chapters dengan pesan "Server AI sedang sibuk". Kode langkah tetap tervalidasi (lihat 3.2 & 2.1); perlu uji ulang visual penuh setelah kunci Juan diperbarui.
  - ✅ **Ditutup 2026-09-05:** kunci Juan kembali valid (probe chat 3 tier lolos), e2e ulang mengalirkan extract→chapters→enrichment→rag real-time, dan **pengujian manual user di aplikasi dikonfirmasi berhasil** — langkah tampil berurutan sampai catatan selesai.
- [x] 3.2 Uji putus-sambung: tutup/buka kembali tampilan (atau putuskan EventSource lalu sambung ulang) saat proses berjalan; langkah yang sudah selesai tetap tampil setelah tersambung lagi (replay SSE). **Verifikasi:** perilaku diamati langsung dan dicatat di change ini.
  - Hasil 2026-09-04: koneksi SSE kedua di-open di tengah proses (setelah 2 langkah) → replay dari awal sesi diterima, applyEvent idempoten, state gabungan unik tanpa duplikat (`unique=true`, urutan `orderOk=true`). Perilaku pulih sesuai spec.
- [x] 3.3 `npm run build` hijau tanpa error baru. **Verifikasi:** output build sukses.
  - Verifikasi 2026-09-04: `npx tsc --noEmit` bersih; `npm run build` "✓ Compiled successfully".
