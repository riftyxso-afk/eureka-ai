## Context

Lihat proposal.md — Why. State saat ini yang membentuk pendekatan:

- **Uji Pemahaman** diimplementasikan sebagai modal `components/note/ComprehensionModal.tsx` (3 tahap: setup → work → result), dipicu tombol "Uji Pemahaman" di `app/dashboard/note/[id]/page.tsx` (`setShowComprehension(true)`). Generator soal `generateComprehension` di `lib/studyTools.ts` memakai `aiChatJson` (non-streaming) — loading spinner statis "Membuat soal...".
- **Pola streaming sudah ada**: `lib/ai.ts` punya `aiChatStream` (SSE, rantai provider, fallback model); `app/api/assistant/chat/route.ts` meneruskan token ke klien via `ReadableStream` (`data: {type:"token",text}`); klien `lib/assistant-stream.ts` membaca dengan `fetch` + `reader.read()` + parse per baris `data:`. Pola ini bisa ditiru untuk streaming soal.
- **Backend Hono** (`backend/src/routes.ts`) memount route API secara manual — endpoint streaming baru WAJIB didaftarkan di sana (pelajaran dari 404 route comprehension sebelumnya).
- **Auth**: klien mengirim bearer via `apiFetch`/fetch manual (`getAccessToken`); route memakai `authorizeAssistantUser`.

## Goals / Non-Goals

**Goals:**
- Alur Uji Pemahaman penuh di halaman `/dashboard/note/[id]/uji-pemahaman` (bukan modal), tombol di halaman catatan jadi navigasi.
- Pembuatan soal dari materi menampilkan token AI secara realtime (efek mengetik), lalu transisi otomatis ke mode pengerjaan.
- Mempertahankan semua perilaku yang ada: konfigurasi jumlah/kesulitan/tipe, ABC + essay, penilaian + penjelasan, upload lembar soal, koreksi essay AI.

**Non-Goals:**
- Tidak mengubah `lib/ai.ts` (aiChatStream sudah cukup).
- Tidak mengubah DB/auth/deployment.
- Tidak menambah tipe soal baru.
- Mode upload lembar soal TIDAK streaming token (ekstraksi vision sekali jalan); streaming hanya untuk soal dari materi catatan.

## Decisions

### D1. Halaman baru + komponen halaman (ganti modal)

- Halaman baru `app/dashboard/note/[id]/uji-pemahaman/page.tsx` (client component, di dalam layout dashboard/AuthGuard yang sudah ada). Fetch catatan via `apiFetch("/api/notes/{id}")` untuk judul & cek bab (reuse pola halaman catatan); tampilkan "catatan tidak ditemukan" dengan tautan balik dashboard bila 404.
- `components/note/ComprehensionModal.tsx` diubah menjadi `components/note/ComprehensionPage.tsx` (nama & struktur UI sama, tanpa wrapper modal `fixed inset-0`; konten dirender sebagai halaman dengan header "Uji Pemahaman" + tombol kembali `router.push("/dashboard/note/{id}")`). Komponen menerima `noteId` + `noteTitle` (dari props halaman).
- Tombol "Uji Pemahaman" di `app/dashboard/note/[id]/page.tsx` diubah dari `setShowComprehension(true)` menjadi `router.push(`/dashboard/note/${data.id}/uji-pemahaman`)`; hapus import modal & state `showComprehension`.
- **Alternatif ditolak**: mempertahankan modal — bertentangan dengan permintaan eksplisit "jangan pop lagi"; membuat komponen duplikat — boros.

### D2. Streaming token realtime untuk soal dari materi

- **Endpoint**: `app/api/notes/[id]/comprehension/stream/route.ts` — `POST`, body `{ count, difficulty, types }`, respons `text/event-stream`. Validasi sama seperti endpoint `comprehension` (count 3–15, difficulty, types, catatan ada & punya bab, auth via `authorizeAssistantUser`).
- **Alur server**: bangun prompt sama seperti `generateComprehension` → panggil `aiChatStream` dengan `onEvent` yang menulis `data: {"type":"token","text":...}` per token (pola `app/api/assistant/chat/route.ts`). Kumpulkan teks penuh; setelah selesai, parse JSON via `extractJsonObject`, validasi ke `ComprehensionQuestion[]` (reuse logika normalisasi `generateComprehension` — diekstrak ke fungsi `normalizeQuestions` agar dipakai dua-duanya), lalu kirim `data: {"type":"done","questions":[...]}` dan `controller.close()`. Bila parse gagal → `data: {"type":"error","message":...}`.
- **Klien**: helper `lib/comprehensionStream.ts` meniru `lib/assistant-stream.ts` (fetch + reader + parse `data:`), menerima event `{type:"token"|"done"|"error"}`. Halaman menampilkan area "menulis realtime": teks token bertambah dengan efek mengetik + kursor berkedip + indikator "AI sedang menulis soal...". Setelah `done` → set soal & pindah ke tahap pengerjaan. `AbortController` untuk tombol batal.
- **Keamanan/kuota**: gunakan `enforcePremium`/rate-limit ringan yang sama dengan endpoint `comprehension` agar streaming tidak dipakai bebas.
- **Alternatif ditolak**: parsing JSON progresif per-token (menampilkan kartu soal yang "sedang terbentuk") — rapuh karena JSON mentah model tidak dijamin terbaca parsial; menampilkan teks mentah realtime lalu transisi bersih lebih andal dan tetap memenuhi efek "sedang menulis".
- **Catatan**: mode upload lembar soal tetap memakai endpoint `upload` non-streaming (vision sekali jalan) — hanya mode "dari materi" yang streaming.

### D3. Registry backend Hono

- `backend/src/routes.ts`: tambahkan `notesComprehensionStream` (import `@/app/api/notes/[id]/comprehension/stream/route`) → `mount(app, "/api/notes/:id/comprehension/stream", ...)`; `count += 1`. Tanpa ini backend (port 3001) tetap 404 (pelajaran dari insiden route comprehension sebelumnya).

## Risks / Trade-offs

- [Streaming token menaikkan biaya/kuota API] → Rate limit + enforcePremium sama seperti endpoint lain; stream hanya saat user memulai generate, bukan idle.
- [Model mengeluarkan markdown fence / teks ekstra sebelum JSON] → `extractJsonObject` sudah toleran (strip ```json, cari `{...}`); pesan error jelas + tombol coba lagi bila tetap gagal.
- [Koneksi terputus di tengah stream] → Klien menampilkan pesan "pembuatan soal terputus" + coba lagi (spec); server menutup stream dengan aman di `finally`.
- [Migrasi modal → halaman mengubah UX yang sudah ada] → Semua state & perilaku (setup/work/result) dipertahankan; hanya wadahnya berubah; tombol kembali selalu tersedia.
- [Backend lupa di-deploy dengan route baru] → Dicatat di Migration Plan; backend & frontend harus deploy bersamaan.

## Migration Plan

1. Implementasi halaman + komponen + endpoint stream + helper klien + registry backend.
2. `npm run build` sukses; verifikasi runtime lokal: buka `/dashboard/note/[id]/uji-pemahaman`, jalankan generate (streaming teks tampil realtime → transisi pengerjaan → hasil), upload lembar soal, kembali ke catatan.
3. Deploy: commit + push `master` → auto-deploy Vercel (frontend) + deploy backend (VPS/Railway/Render — sesuai DEPLOYMENT.md) karena `backend/src/routes.ts` berubah.
4. Rollback: revert commit kode (git); endpoint `comprehension` non-stream lama tetap ada sehingga halaman bisa di-fallback, tidak ada perubahan DB.

## Open Questions

- Tidak ada yang mengubah spec/approach/task breakdown. (Detail yang bisa diputuskan saat implementasi: kecepatan efek mengetik, gaya kursor, wording pesan error, ikon tombol kembali.)
