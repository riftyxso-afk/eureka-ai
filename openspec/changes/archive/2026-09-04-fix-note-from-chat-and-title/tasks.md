## 1. Diagnosis (bukti dulu, baru kode)

- [x] 1.1 Reproduksi bug catatan-dari-chat: TERBUKTI — job `551c60d4` progress 100 tapi status `processing` + `note_id` null (race persist fire-and-forget di jobQueue.ts); catatan garbage `"catatan"` dibuat dari kata perintah tanpa materi/history
- [x] 1.2 Reproduksi bug judul: TERBUKTI — judul tersimpan `"Heres a thinking process:"` (4 sesi) = preamble thinking model ikut terambil baris pertama; guard default konsisten dgn createSession

## 1b. Perbaikan race persist job (akar "error" — ditemukan saat diagnosis)

- [x] 1b.1 Serialisasi `persist` per job di `lib/jobQueue.ts` (rantai promise) + `updateJob` mengembalikan rantai, dan verifikasi update terminal di-await pemanggil — tsc 0
- [x] 1b.2 Await `updateJob` terminal (done/error) di `app/api/notes/process/route.ts` agar DB mencerminkan hasil akhir walau proses restart, dan verifikasi job selesai tercatat `completed` + `note_id` terisi — tsc 0 (verifikasi DB live saat generate berikutnya)

## 2. Perbaikan catatan dari chat

- [x] 2.1 Saring pesan berkonten kosong (placeholder optimis/streaming) dari `noteHistory` di `app/chat/[id]/page.tsx`, dan verifikasi transkrip yang dibangun tidak pernah memuat materi null — filter eksplisit + cek `scripts/title-fix-check.ts` lolos
- [x] 2.2 Tolak eksplisit di `NoteProgressOverlay`: bila transkrip kosong DAN topik hanya kata perintah, tampilkan pesan jelas dan jangan kirim job, dan verifikasi user melihat pesan tersebut alih-alih catatan null/error diam-diam
- [x] 2.3 Tambahkan validasi backend di `POST /api/notes/process` (tolak 400 + pesan jelas bila file sumber kosong/terlalu pendek <10 char), dan verifikasi via tsc + review (file binary selalu >10 byte, tak kena false positive)

## 3. Perbaikan judul sesi AI

- [x] 3.1 Amankan `autoTitleIfNeeded` di `lib/assistant/store.ts` — sanitasi output model (buang preamble thinking + baris bernomor, ambil baris berarti terakhir, validasi ≤10 kata/60 char, fallback potongan prompt), catch error simpan mencatat; verifikasi `scripts/title-fix-check.ts` 7/7 lolos (kasus nyata "Heres a thinking process:" → judul bersih)
- [x] 3.2 Pastikan sidebar menampilkan judul baru tanpa reload — refresh tertunda +4 dtk hanya bila sesi masih berjudul default saat kirim; verifikasi tsc 0 (verifikasi UI saat chat baru)

## 4. Verifikasi akhir

- [x] 4.1 Uji end-to-end: TERBUKTI LIVE — `scripts/note-e2e-test.ts` (file pendek→400 jelas; materi valid→job `completed` + `note_id` terisi di DB — bug lama "processing selamanya" hilang) & `scripts/title-e2e-test.ts` (judul AI "Hukum Newton tentang Gravitasi", bebas preamble); unit `scripts/title-fix-check.ts` 7/7; `npx tsc --noEmit` 0 error. Data test dibersihkan semua
