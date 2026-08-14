## Context

Web search saat ini satu provider (Firecrawl) di `lib/firecrawl.ts` dengan pemakai: tool web search assistant (`app/api/assistant/chat/route.ts`), enrichment bab (`lib/webSearchEnrichment.ts`), `lib/pdfImages.ts`, `lib/noteEnrich.ts` — semuanya berjalan di server Next (Vercel). Kuis halaman catatan (`components/note/QuizModal.tsx`) bersifat lokal: soal di-generate, dikerjakan, hasil langsung hilang saat modal ditutup; tidak ada konsep share/persist. Infra Realtime Supabase sudah dipakai untuk presence/collab catatan (`lib/collab.ts`, route `/api/notes/[id]/presence`). Loading chat di `app/chat/[id]/page.tsx` masih spinner lingkaran. Lihat proposal.md untuk motivasi.

## Goals / Non-Goals

**Goals:**
- Fallback Tavily terpusat di satu helper agar keempat pemakai web search otomatis dapat fallback tanpa duplikasi logika.
- Kuis catatan bisa dibagikan (link publik view-only) dan dijadikan ruang live dengan leaderboard realtime, tanpa login untuk penerima.
- Loading chat berupa skeleton bubble yang stabil (tanpa lonjakan layout).

**Non-Goals:**
- Tidak mengubah provider utama (Firecrawl tetap primary).
- Tidak menambah fitur share/live ke popup `/kuis` chat (hanya modal kuis halaman catatan).
- Tidak membuat sistem akun untuk partisipan publik (identitas cukup nama tampilan; host satu-satunya yang berwenang memulai/mengakhiri).
- Tidak menambah chat antar partisipan di ruang live (hanya progres + leaderboard).

## Decisions

### 1. Fallback Tavily terpusat di satu helper `searchWeb`
Buat `lib/tavily.ts` (`tavilySearch(query, limit)` → `SearchResult[]` bentuk sama persis dengan Firecrawl) dan helper `searchWeb(query, limit)` di `lib/firecrawl.ts`: coba `firecrawlSearch` → bila error/kosong dan `TAVILY_API_KEY` ada → coba `tavilySearch` → dedup by URL + filter noise (pakai `isNoiseSearchResult` yang ada). Keempat pemakai pindah ke `searchWeb`.
- *Alternatif ditolak*: fallback per-pemakai (4 blok duplikat, rawan inkonsisten) dan penggabungan hasil dua provider (kompleks, tidak diminta).

### 2. Token ber-prefix untuk satu route `/quiz/[token]`
Share kuis dan ruang live berbagi satu halaman publik `app/quiz/[token]/page.tsx`; token share diawali `s_`, token room diawali `r_` → klien tahu jenisnya dan memanggil API yang sesuai. Menghindari dua route + kemungkinan tabrakan token antar tabel.
- *Alternatif ditolak*: dua halaman terpisah (`/quiz-s/...`, `/quiz-r/...`) — lebih banyak kode UI duplikat.

### 3. Snapshot soal di saat share
`quiz_shares` menyimpan `questions` sebagai JSONB (snapshot soal saat dibagikan), bukan referensi ke generation yang bisa berubah. Menjamin "penerima melihat soal yang sama" sesuai spec, dan room live memakai snapshot yang sama.

### 4. Identitas partisipan: nama unik per room + `participantKey`
`quiz_room_participants` punya `UNIQUE(room_id, name)`; setiap partisipan (termasuk host) mendapat `participant_key` acak yang menjadi otorisasi submit/mulai (host punya `is_host=true`). Satu submit per partisipan di-enforce server-side (`submitted_at IS NULL` pada submit, unique violation → 409). `participant_key` disimpan di sessionStorage sehingga jawaban dipulihkan saat membuka ulang room (sesuai spec).

### 5. Realtime via Supabase Realtime `postgres_changes` pada `quiz_room_participants`
Klien room subscribe channel `quiz_room:<id>` pada perubahan baris `quiz_room_participants` (filter `room_id`) → leaderboard dihitung ulang dari payload. Pola sama dengan presence/collab yang sudah ada; tanpa server push tambahan. Patch SQL menyertakan `alter publication supabase_realtime add table quiz_room_participants`.

### 6. Env `TAVILY_API_KEY` dibaca server-side
`lib/tavily.ts` membaca `process.env.TAVILY_API_KEY`; karena semua pemakai web search berjalan di route server Next (Vercel), user mengisi key di Vercel project env + `.env` VPS (backend Hono). Tanpa key, fallback dilewati (perilaku hari ini) sesuai spec.

### 7. Skeleton chat berbasis CSS (tanpa framer-motion)
`components/asisten/ChatSkeleton.tsx`: 3–4 placeholder bubble (user kanan kecil, AI kiri lebar multi-baris) dengan shimmer via keyframes CSS + `motion-reduce:animate-none` untuk aksesibilitas, `aria-busy` pada kontainer, tinggi baris meniru bubble asli agar tidak ada lonjakan layout saat diganti konten.
- *Alternatif ditolak*: skeleton dengan framer-motion — berat untuk efek yang sama; CSS cukup.

## Risiko / Trade-offs

- [Penyalahgunaan room publik (nama tiruan, spam join)] → Nama unik per room + `participant_key`; room bersifat sementara; bila parah, batasi jumlah partisipan per room (konstanta).
- [Realtime terbatas: payload `postgres_changes` berisi seluruh baris partisipan] → Leaderboard tetap kecil (jumlah partisipan wajar); filter `room_id` membatasi volume.
- [Kuis di-share berisi snapshot yang bisa kedaluwarsa] → Disengaja: soal dikunci saat share; regeneration membuat share baru bila diinginkan.
- [`TAVILY_API_KEY` belum diisi → fallback tidak aktif] → Perilaku sama dengan hari ini (Firecrawl saja); dokumentasi env di deploy.

## Migration Plan

1. Jalankan `supabase_patch_006_quiz_rooms.sql` manual di Supabase SQL Editor (buat tabel `quiz_shares`, `quiz_rooms`, `quiz_room_participants` + Realtime publication).
2. Backend: tambah `TAVILY_API_KEY` di Vercel project env + `.env` VPS; redeploy Vercel + `pm2 restart eureka-api` di VPS (route baru di-mount di `backend/src/routes.ts`).
3. Rollback: fitur baru tidak mengubah perilaku lama; mematikan fallback = hapus env key; menghapus route quiz = kode lama tetap berfungsi.

## Open Questions

(tidak ada — keputusan yang perlu diketahui sudah diputuskan di atas; detail kecil seperti jumlah maksimum partisipan room diserahkan ke implementasi dengan konstanta wajar)