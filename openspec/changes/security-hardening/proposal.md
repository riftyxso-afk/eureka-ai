## Why

Eureka.AI siap diluncurkan ke produksi dan akan di-endorse secara publik, tetapi audit menemukan celah keamanan kritis: kunci `service_role` Supabase asli ter-commit di git (berlaku sampai 2036), puluhan endpoint API tanpa autentikasi (termasuk IDOR yang bisa membaca/mengubah profil, catatan, progres, hingga menaikkan plan sendiri jadi "pro"), policy RLS yang mengekspos data semua pengguna (users, documents, kunci host kuis live), CORS default `*` dengan credentials, dan celah pemakaian AI lintas-pengguna yang bisa membocorkan isi catatan melalui RAG. Satu saja dari celah ini dieksploitasi setelah launch = kebocoran data semua pengguna dan hilangnya kepercayaan publik.

## What Changes

- **Rotasi & penghapusan rahasia bocor**: `service_role` key di 4 file `scripts/test-*.mjs` dihapus dari git (history scrub), diganti baca dari env; `dev.log`/`dev.err.log` di-ignore; sisa key terpotong di dokumentasi dibersihkan. Seluruh env dipastikan hanya lewat environment variable.
- **Autentikasi & otorisasi endpoint**: semua endpoint `app/api` yang menyentuh data pengguna memverifikasi Supabase JWT (`Authorization: Bearer`) dan memaksa `token.user.id === userId` (memakai pola `authorizeAssistantUser` yang sudah ada). Menghapus fallback "percayai param userId saat Supabase tidak terkonfigurasi" yang bisa menonaktifkan auth diam-diam.
- **Perbaikan IDOR spesifik**: `/api/profile` (baca/ubah profil siapa pun + eskalasi plan ke "pro" tanpa bayar), `/api/notes` GET/PATCH/PDF, `/api/notes/query`, `/api/notes/[id]/ask`, `/api/chat`, `/api/progress`, `/api/leaderboard`, `/api/friends/*`, `/api/notifications`, `/api/exams`, `/api/notes/jobs/[jobId]` — semuanya divalidasi kepemilikan; gating plan premium dilakukan server-side (tidak dari client).
- **Perketat RLS database**: policy `users` dan `documents` yang terbuka untuk semua authenticated user diganti dengan policy terkunci kolom (hanya kolom yang diperlukan, `security definer`/function bila perlu); `quiz_rooms`/`quiz_room_participants` tidak lagi `SELECT USING (true)` — `host_key`/`participant_key` tidak boleh terbaca publik.
- **Perketat pengaman AI terhadap kebocoran database**: guardrail `ai-safety` diperkuat — AI tidak boleh membongkar isi, struktur, skema, tabel, baris database, atau data pengguna lain lewat RAG/prompt apa pun; konteks prompt dipastikan tidak memuat data DB internal; endpoint AI lintas-pengguna (chat/ask/query) diautentikasi sehingga materi RAG hanya milik pemiliknya.
- **Pengaman transport & respons**: CORS whitelist ketat (bukan `*` + credentials), security headers (CSP, HSTS, frame-options, dll.), error response tidak membocorkan pesan exception mentah, rate limiting diperluas ke endpoint AI publik.
- **Verifikasi akhir**: checklist audit pra-launch (secret scan, endpoint auth matrix, RLS review, prompt injection test) sebagai acceptance criteria.

## Capabilities

### New Capabilities

- `api-authorization`: Semua endpoint API yang menyentuh data pengguna wajib memverifikasi JWT Supabase dan memaksa kepemilikan resource; userId dari client tidak pernah dipercaya; gating fitur (plan) ditentukan server-side.
- `database-security`: Policy RLS tidak mengekspos data pengguna lain; kolom sensitif (email, kunci akses kuis) tidak terbaca publik; akses hanya via policy terkunci / function `security definer`.
- `web-security`: Respons HTTP memuat security headers standar; CORS hanya mengizinkan origin terdaftar; rahasia tidak pernah muncul di bundle client, log, atau pesan error; secret scan sebagai gate.

### Modified Capabilities

- `ai-safety`: Diperkuat — asisten tidak boleh membocorkan isi/struktur/skema database atau data pengguna lain melalui RAG atau konteks apa pun; konteks prompt bebas dari data DB internal; materi yang di-embed hanya milik user yang terautentikasi.

## Impact

- **Kode**: ±30 endpoint di `app/api/**`, helper `lib/assistant/auth.ts`, `lib/ai.ts`, `lib/rag/**`, `lib/prompts/safety.ts`, `lib/profile.ts`, `backend/src/server.ts` (CORS), `next.config.mjs` (headers).
- **Database**: SQL patch baru di Supabase (`supabase_patch_017_security.sql`) — perbaikan RLS users/documents/quiz_rooms; rotasi `service_role` key wajib dilakukan owner di dashboard Supabase (tindakan manual, kunci lama harus dicabut).
- **Env**: `CORS_ORIGIN` wajib diisi daftar origin produksi; skrip test memakai `SUPABASE_SERVICE_ROLE_KEY` dari env.
- **Risiko**: rotasi key memutus akses sementara bagi proses yang masih memakai kunci lama (backend, skrip) sampai env diperbarui; perubahan policy RLS bisa memengaruhi fitur yang mengandalkan query lintas-user (leaderboard, pencarian teman) — perlu query pengganti.