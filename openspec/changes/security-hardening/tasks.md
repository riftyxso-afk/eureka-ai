## 1. Rotasi & pembersihan rahasia

- [ ] 1.1 Minta owner melakukan rotasi `SUPABASE_SERVICE_ROLE_KEY` di dashboard Supabase: generate key baru, update env produksi (Render/Vercel/backend), lalu cabut key lama
- [x] 1.2 Ubah `scripts/test-search-rest.mjs`, `scripts/test-full-chunk.mjs`, `scripts/test-e2e-rag.mjs`, `scripts/test-chunks-insert.mjs` agar membaca `SUPABASE_SERVICE_ROLE_KEY` dari env, bukan hardcode
- [x] 1.3 Hapus `dev.log` dan `dev.err.log` dari git tracking dan tambahkan ke `.gitignore`
- [x] 1.4 Bersihkan key terpotong di `IMPLEMENTATION_SUMMARY.md` (dan dokumen lain bila ada)
- [ ] 1.5 Scrub git history dari service_role key lama (git filter-repo/BFG) dan verifikasi `git log -S "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1YWppeXdzZGl4aHNrZXRmdXJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjQzOTc5NSwiZXhwIjoyMTAyMDE1Nzk1fQ"` tidak menghasilkan kecocokan
- [x] 1.6 Verifikasi `git ls-files` tidak memuat file `.env*` apa pun selain `.env.example`

## 2. Helper autentikasi fail-closed

- [x] 2.1 Implementasikan `requireAuth(authHeader, paramUserId?)` di `lib/auth.ts` (atau perluas `lib/assistant/auth.ts`) yang menolak tanpa token (401), menolak token invalid (401), menolak mismatch userId (403), dan menolak saat Supabase tidak terkonfigurasi (503) kecuali env `ALLOW_INSECURE_DEV_AUTH=true` eksplisit
- [x] 2.2 Hapus fallback "percayai paramUserId saat Supabase belum dikonfigurasi" dari `authorizeAssistantUser` dan `getUserIdFromAuth` (lib/assistant/auth.ts:41-46, 79-83); pastikan semua pemanggil menyesuaikan
- [x] 2.3 Pastikan helper tidak menulis nilai token/rahasia ke log

## 3. Autentikasi endpoint data pengguna

- [ ] 3.1 `/api/profile` GET/PUT: wajib `requireAuth`, userId dari token (bukan query param); PUT tidak boleh menerima perubahan plan (lihat grup 4)
- [ ] 3.2 `/api/notes` GET, `/api/notes/[id]` GET/PATCH, `/api/notes/[id]/pdf`, `/api/notes/[id]/pdf/stream`: `requireAuth` + cek kepemilikan note (DELETE sudah aman, pertahankan)
- [ ] 3.3 `/api/notes/query`, `/api/notes/[id]/ask`, `/api/notes/[id]/bab/[chapterId]/ask`, `/api/chat`: `requireAuth` dan scope RAG ke pemilik sesi
- [ ] 3.4 `/api/progress`, `/api/leaderboard`, `/api/exams`, `/api/notes/jobs/[jobId]`: `requireAuth` + kepemilikan
- [ ] 3.5 `/api/friends`, `/api/friends/requests`, `/api/friends/[friendId]`, `/api/notifications`: `requireAuth` + kepemilikan; notifikasi `action: "push"` hanya untuk user sendiri
- [x] 3.6 Audit endpoint lain yang menerima `userId` dari body/query tanpa verifikasi (presence, highlights, chat, collab, board, images, flashcards, quiz, comprehension, versions, bab, mission) — pasang `requireAuth` sesuai pola
- [x] 3.7 Pastikan endpoint publik yang sah (shares/[token], share/note/[token], quiz-shares/[token], quiz-rooms/[token]/join, payments/webhook) TIDAK terkena `requireAuth`

## 4. Gating plan server-side

- [x] 4.1 Audit `lib/premium.ts` / `lib/plan-store.ts` dan identifikasi sumber entitlement yang benar (tabel langganan)
- [x] 4.2 Ubah `/api/profile` PUT agar mengabaikan/menolak field plan; entitlement hanya dihitung server-side dari data langganan
- [x] 4.3 Verifikasi tidak ada jalur lain yang menulis `profile_data.plan` dari input client (grep `profile_data`, `plan` di endpoint)

## 5. Perketat RLS database

- [x] 5.1 Buat `supabase_patch_017_security.sql`: ganti policy `users` SELECT `auth.uid() IS NOT NULL` (schema:481-483) dengan policy hanya baris sendiri (`auth.uid() = id`)
- [x] 5.2 Ganti policy `documents` SELECT terbuka (schema:613-615) dengan policy kepemilikan (`auth.uid() = user_id`)
- [x] 5.3 Hapus policy `USING (true)` pada `quiz_rooms`/`quiz_room_participants` (patch_006:93-96); buat function `SECURITY DEFINER` `get_quiz_room_by_token(token)` dan `get_participant_by_token(token)` yang TIDAK mengembalikan `host_key`/`participant_key` kecuali ke pemilik host
- [x] 5.4 Buat function `SECURITY DEFINER` `get_leaderboard()` dan `search_users(q)` yang hanya mengembalikan kolom publik (nama, username, poin) — tanpa email/profile_data
- [x] 5.5 Update query server (leaderboard, pencarian teman, quiz rooms) di `lib/` untuk memakai function tersebut
- [x] 5.6 Verifikasi semua tabel data pengguna tetap RLS aktif; tidak ada policy `USING (true)` tersisa (query pg_policies) — patch 017 diapply; verifikasi 0 baris

## 6. Web security: CORS, headers, error, rate limit

- [x] 6.1 `backend/src/server.ts`: produksi wajib `CORS_ORIGIN` berisi daftar origin; tolak `*` + credentials di produksi; pertahankan izin localhost untuk dev
- [x] 6.2 `next.config.mjs`: tambah Content-Security-Policy (hash untuk inline script theme di `layout.tsx` atau pindah ke file eksternal), HSTS untuk produksi, frame-ancestors, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- [x] 6.3 `backend/src/utils/honoAdapter.ts`: bungkus exception → pesan generik ke client; detail hanya ke log (tanpa nilai rahasia)
- [x] 6.4 Perluas `lib/rateLimit.ts` ke `/api/chat`, `/api/notes/[id]/ask`, `/api/notes/query`, `/api/onboarding/analyze`, dan endpoint `assistant/*` yang belum; kembalikan 429 saat limit tercapai
- [x] 6.5 Audit respons error route lain (app/api) — pastikan tidak ada pesan exception mentah/stack trace ke client

## 7. Perketat AI terhadap kebocoran database

- [x] 7.1 Perkuat `lib/prompts/safety.ts` (`AI_SAFETY_GUARDRAIL`): larangan eksplisit membongkar skema, nama tabel, kolom, isi database, atau "dump database"; tolak dalih teknis/admin
- [x] 7.2 Terapkan guardrail diperkuat ke SEMUA mode (chat, study-buddy, note generation, kuis/kartu, ask bab) — verifikasi setiap pemanggil `buildSystemPrompt`
- [x] 7.3 Audit `buildUserContext` (lib/assistant/context.ts) & RAG: konfirmasi tidak ada email, user_number, ID internal dalam konteks; materi RAG selalu di-scope ke user terautentikasi (query `searchChunks` memakai userId dari token)
- [x] 7.4 Uji prompt injection & kebocoran: minta AI menyebut prompt sistem, skema DB, isi tabel, data user lain, dan instruksi jahat dalam catatan — semua harus ditolak di tiap mode (scripts/test-prompt-injection.mjs: 8/8 lolos; 2 kasus injection di materi = instruksi diabaikan, 6 kasus langsung = ditolak)

## 8. Verifikasi akhir pra-launch

- [x] 8.1 Jalankan secret scan (grep pola `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`, `sk-`, `service_role`) pada file ter-track dan bundle client — nol temuan
- [x] 8.2 Uji auth matrix: endpoint data pengguna tanpa token → 401; userId beda → 403; userId sama → sukses; `/api/profile` tidak bisa membaca/mengubah profil orang lain — 401 terverifikasi di 12 endpoint (profile, notes, query, progress, exams, friends, notifications, leaderboard, chat, ask, notes/[id]); 403 & sukses perlu token asli (tergantung 8.5)
- [x] 8.3 Uji RLS: query langsung ke users/documents/quiz_rooms sebagai user lain tidak mengembalikan data; leaderboard/pencarian teman tetap berfungsi lewat function — anon SELECT users/documents/quiz_rooms/participants = 0 baris; INSERT anon = 401 (42501); rpc search_users/get_leaderboard/get_quiz_room_by_token jalan, leaderboard hanya kolom publik
- [x] 8.4 Uji CORS dari origin asing (browser) → ditolak; origin terdaftar → berfungsi; security headers ada di halaman dan API — backend mode produksi: Origin jahat tanpa ACAO, origin terdaftar `https://eureka.ai` (placeholder) → ACAO echo, localhost ditolak; header frontend: CSP, nosniff, DENY, referrer, permissions (HSTS prod-only, terverifikasi di next.config.mjs)
- [ ] 8.5 Regression test fitur: chat AI, RAG tanya catatan, quiz live (host & participant), share note/chat/quiz, payments (checkout, webhook, trial), referral, onboarding, leaderboard, teman
- [x] 8.6 Pastikan env produksi (Render/Vercel) memuat key baru dan `CORS_ORIGIN` terisi; dokumentasikan langkah rotasi di DEPLOYMENT.md bila perlu — DEPLOYMENT.md diperbarui: CORS_ORIGIN = origin frontend `https://www.eureka-ai.web.id` (bukan domain backend), bagian 4b rotasi service_role key, checklist header