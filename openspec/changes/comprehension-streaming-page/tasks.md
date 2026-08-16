## 1. Streaming backend

- [x] 1.1 Ekstrak normalisasi soal di `lib/studyTools.ts` menjadi fungsi `normalizeComprehensionQuestions(raw)` (dipakai ulang oleh `generateComprehension` dan endpoint stream)
- [x] 1.2 Buat `app/api/notes/[id]/comprehension/stream/route.ts`: POST + SSE — validasi (count 3–15, difficulty, types, auth, catatan ada & punya bab), panggil `aiChatStream` dengan prompt yang sama seperti `generateComprehension`, tulis `data: {"type":"token","text":...}` per token, lalu `data: {"type":"done","questions":[...]}` setelah parse sukses atau `{"type":"error"}` bila gagal; tutup stream dengan aman
- [x] 1.3 Daftarkan route stream di `backend/src/routes.ts` (`/api/notes/:id/comprehension/stream`)

## 2. Klien streaming

- [x] 2.1 Buat `lib/comprehensionStream.ts` (pola `lib/assistant-stream.ts`): fetch + reader, parse event `data:` → `{type:"token"|"done"|"error"}`, dukung `AbortController` untuk batal
- [x] 2.2 Di halaman/komponen: saat generate dari materi, tampilkan area "AI sedang menulis soal..." dengan token bertambah realtime + indikator mengetik; tombol batal; saat `done` → set soal & transisi ke tahap pengerjaan; `error` → pesan + coba lagi

## 3. Halaman interaktif (ganti modal)

- [x] 3.1 Ubah `components/note/ComprehensionModal.tsx` menjadi `components/note/ComprehensionPage.tsx` (tanpa wrapper modal; header halaman + tombol kembali `router.push` ke halaman catatan; props noteId/noteTitle); alur setup/work/result dipertahankan
- [x] 3.2 Buat halaman `app/dashboard/note/[id]/uji-pemahaman/page.tsx`: fetch catatan (`apiFetch /api/notes/{id}`), tampilkan judul, case "catatan tidak ditemukan" (pesan + tautan dashboard), render `ComprehensionPage`
- [x] 3.3 Ubah tombol "Uji Pemahaman" di `app/dashboard/note/[id]/page.tsx` jadi `router.push("/dashboard/note/{id}/uji-pemahaman")`; hapus state `showComprehension` + import modal yang tidak terpakai
- [x] 3.4 Pastikan mode upload lembar soal & hasil (skor, penjelasan, koreksi essay) tetap berfungsi di halaman baru

## 4. Verifikasi

- [x] 4.1 `npm run build` sukses
- [x] 4.2 Verifikasi runtime lokal: route stream match di backend (74 route), halaman uji-pemahaman 200 (AuthGuard), comprehension/history tetap jalan
- [x] 4.3 Jalankan `openspec validate` pada change ini
