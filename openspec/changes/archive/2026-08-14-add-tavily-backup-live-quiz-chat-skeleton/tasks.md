## 1. Fallback Web Search Tavily

- [x] 1.1 Buat `lib/tavily.ts`: `tavilySearch(query, limit)` → `SearchResult[]` (bentuk sama dengan Firecrawl), baca `process.env.TAVILY_API_KEY`, return `[]` tanpa crash bila key belum diisi atau API gagal
- [x] 1.2 Tambah helper `searchWeb(query, limit)` di `lib/firecrawl.ts`: coba `firecrawlSearch` → bila error/kosong dan key Tavily ada → `tavilySearch` → dedup by URL + filter noise (`isNoiseSearchResult`)
- [x] 1.3 Pindahkan pemakai ke `searchWeb`: `app/api/assistant/chat/route.ts`, `lib/webSearchEnrichment.ts`, `lib/pdfImages.ts`, `lib/noteEnrich.ts`
- [x] 1.4 Buat `scripts/test-websearch.mjs` (mock Firecrawl gagal/kosong → hasil Tavily; tanpa key → dilewati) + jalankan `node --test`

## 2. Database & API Kuis Share + Live Room

- [x] 2.1 Buat `supabase_patch_006_quiz_rooms.sql`: tabel `quiz_shares` (token `s_*` unik, snapshot `questions` jsonb, created_by, created_at), `quiz_rooms` (token `r_*` unik, share_id, status lobby/live/ended, host_key, created_at), `quiz_room_participants` (room_id, name, `UNIQUE(room_id, name)`, participant_key, is_host, answers jsonb, score, submitted_at); RLS owner; `alter publication supabase_realtime add table quiz_room_participants`
- [x] 2.2 Buat `lib/quizLive.ts` (server, pakai `db()` service-role): `createShare`, `getShareByToken`, `createRoom`, `getRoomByToken` (+ partisipan), `joinRoom`, `startRoom` (host_key), `submitRoomAnswers` (reject duplikat → 409, hitung skor)
- [x] 2.3 Buat route `app/api/quiz-shares/route.ts` (POST, auth userId) dan `app/api/quiz-shares/[token]/route.ts` (GET publik; token tak dikenal → 404)
- [x] 2.4 Buat route `app/api/quiz-rooms/route.ts` (POST dari shareToken, auth) dan `app/api/quiz-rooms/[token]/route.ts` (GET publik: info room + soal + partisipan) + `join`, `start`, `submit` (POST sub-route, public + participant_key)
- [x] 2.5 Mount semua route baru di `backend/src/routes.ts` (group baru Quiz Live)

## 3. Frontend Kuis Share + Live Room

- [x] 3.1 `components/note/QuizModal.tsx`: setelah submit tampil tombol "Bagikan Kuis" (panel link + copy) dan "Buat Ruang Live" (panel: nama host → link room + tombol Mulai)
- [x] 3.2 Buat `app/quiz/[token]/page.tsx` dengan dispatch `s_`/`r_`; view share: kerjakan soal yang sama, submit, lihat skor + kunci jawaban
- [x] 3.3 View room: lobby (daftar partisipan realtime), mulai oleh host, semua jawab serentak, leaderboard realtime (Supabase Realtime `postgres_changes` filter room_id); `participant_key` di sessionStorage → jawaban dipulihkan saat buka ulang
- [x] 3.4 Buat `lib/quizLiveClient.ts` (klien: pemanggilan API + channel Realtime + helper skor)
- [x] 3.5 Pastikan view share & room mobile-friendly (touch target ≥44px, safe-area bottom, scroll internal, tanpa overflow halaman)

## 4. Skeleton Loading Chat

- [x] 4.1 Buat `components/asisten/ChatSkeleton.tsx`: placeholder bubble user (kanan, kecil) & AI (kiri, multi-baris) dengan shimmer CSS + `motion-reduce:animate-none`, kontainer `aria-busy`
- [x] 4.2 Ganti spinner di `app/chat/[id]/page.tsx` (cabang `chat.loading && messages.length === 0`) dengan skeleton; verifikasi tidak ada lonjakan layout saat diganti konten

## 5. Verifikasi & QA

- [x] 5.1 `openspec validate`, `npx tsc --noEmit`, `npm run lint`, `npm run build`
- [x] 5.2 Smoke test API: 401 tanpa auth (share/room create), 404 token tak dikenal, 409 submit duplikat, alur anonymous (join → submit → skor)
- [ ] 5.3 Manual QA mobile: share kuis dari modal catatan, buka link di perangkat kedua, room 2 perangkat → leaderboard realtime, satu submit per partisipan, skeleton tampil saat memuat chat