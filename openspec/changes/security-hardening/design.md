## Context

Lihat proposal.md — Why untuk motivasi penuh. Kondisi saat ini yang membentuk pendekatan:

- Auth sudah ada polanya: `lib/assistant/auth.ts` (`authorizeAssistantUser`) dipakai oleh endpoint asisten; endpoint lain (profile, notes, progress, friends, dsb.) menerima `userId` tanpa verifikasi. Helper yang sama punya fallback berbahaya: mempercayai `paramUserId` saat Supabase tidak terkonfigurasi.
- Arsitektur dual-runtime: handler Next.js di `app/api/**` dimount ke backend Hono (`backend/src/routes.ts` + `honoAdapter.ts`). Solusi auth/header/error harus bekerja di kedua runtime.
- RLS: semua tabel sudah `enable row level security`, tapi 3 area bocor: `users` (SELECT semua kolom untuk semua authenticated user), `documents` (SELECT publik), `quiz_rooms`/`quiz_room_participants` (SELECT `USING (true)` termasuk `host_key`/`participant_key`).
- Rahasia: service_role key valid ter-commit di 4 file `scripts/test-*.mjs`; `dev.log`/`dev.err.log` ter-track; sebagian key terpotong di `IMPLEMENTATION_SUMMARY.md`.
- Guardrail AI sudah ada: `lib/prompts/safety.ts` (AI_SAFETY_GUARDRAIL) + spec `ai-safety`; celah utama bukan prompt-nya, melainkan endpoint `/api/chat`, `/api/notes/[id]/ask`, `/api/notes/query` yang tidak terautentikasi sehingga materi RAG milik orang lain bisa di-embed ke prompt.

## Goals / Non-Goals

**Goals:**
- Menutup semua IDOR dan endpoint tanpa auth dengan pola helper tunggal yang fail-closed.
- Menghapus rahasia dari repo/git history dan memindahkannya ke env.
- Menutup policy RLS yang terbuka; visibilitas lintas-user hanya lewat function terkunci.
- Memperkuat guardrail AI terhadap kebocoran database + memastikan materi konteks selalu scoped ke pemilik sesi.
- CORS whitelist, security headers, error handling, dan rate limit sebagai lapisan transport.

**Non-Goals:**
- Menulis ulang arsitektur (Next ↔ Hono) atau mengganti provider AI/DB.
- Audit keamanan aplikasi pihak ketiga (Supabase infra, provider AI) — hanya konfigurasi di repo ini.
- Migrasi data atau perubahan skema tabel (selain policy/function).
- Perubahan UX/fitur; perilaku fitur yang sudah benar dipertahankan.

## Decisions

**1. Helper otorisasi tunggal `requireAuth` (fail-closed).**
Perluas `authorizeAssistantUser` menjadi `requireAuth(authHeader, paramUserId?)` di `lib/auth.ts` (framework-agnostic): wajib ada token, diverifikasi via `db().auth.getUser()`, dan bila `paramUserId` ada wajib cocok. Semua endpoint data pengguna memanggil helper ini. Saat Supabase tidak terkonfigurasi: mode produksi → tolak 503; mode dev hanya jika env flag `ALLOW_INSECURE_DEV_AUTH=true` eksplisit (tidak pernah default).
*Alternatif: middleware global* — ditolak karena handler dipakai di dua runtime (Next standalone + Hono) dan sebagian endpoint memang publik (token share, webhook). Helper eksplisit per-route lebih transparan dan tidak berisiko memblokir endpoint publik.

**2. Rotasi service_role key + pembersihan git.**
Owner melakukan rotasi manual di dashboard Supabase (cabut key lama, generate baru) — tugas manual, tercatat di tasks. Repo: hapus key dari 4 file script (baca `process.env.SUPABASE_SERVICE_ROLE_KEY`), scrub history dengan `git filter-repo`/BFG, tambah `dev.log`/`dev.err.log` ke .gitignore dan hapus dari tracking. `IMPLEMENTATION_SUMMARY.md` dibersihkan. Env produksi (Render/Vercel) diperbarui dengan key baru sebelum key lama dicabut.

**3. RLS: function `SECURITY DEFINER` untuk visibilitas lintas-user.**
- `users`: policy SELECT hanya `auth.uid() = id` (baris sendiri). Kolom sensitif (email, `user_number`, `profile_md`, `profile_data`) tidak terekspos lewat policy apa pun; endpoint profil memakai service-role (sudah) + auth helper.
- `documents`: policy SELECT `auth.uid() = user_id`.
- `quiz_rooms`/`quiz_room_participants`: hapus `USING (true)`; akses via function `get_quiz_room(token)` / `get_quiz_room_participant(token)` SECURITY DEFINER yang memvalidasi pemanggil dan TIDAK mengembalikan `host_key`/`participant_key` kecuali ke pemilik room (host).
- Leaderboard/pencarian teman/profil publik: function definer baru (`get_leaderboard()`, `search_users(q)`, `get_public_profile(userId)`) yang hanya mengembalikan kolom publik.
*Alternatif: column-level grants* — lebih sulit dipelihara dan masih perlu fungsi untuk join; definer function juga menyembunyikan logika dari client. Dipilih function.

**4. Gating plan server-side.**
Entitlement dihitung dari tabel langganan (`subscriptions`/pakasir) via helper `lib/premium.ts` yang sudah ada — cek alurnya dan pindahkan keputusan "apakah pro" dari `profile_data.plan` (yang bisa diedit via `/api/profile` tanpa auth) ke sumber langganan. `/api/profile` PUT tidak boleh menerima field plan.

**5. CORS & headers di kedua runtime.**
- Backend Hono: `CORS_ORIGIN` wajib daftar origin; `*` hanya diizinkan jika env `NODE_ENV !== production` atau flag eksplisit; default produksi = tolak.
- `next.config.mjs`: tambah CSP. Inline script theme di `layout.tsx` → pakai hash (`'sha256-…'`) atau pindah ke file eksternal; `react-markdown` tanpa raw HTML aman. Tambah HSTS (produksi), frame-ancestors, referrer, permissions-policy.
- Backend Hono: middleware headers serupa untuk respons API.

**6. Error handling & rate limit.**
`honoAdapter.ts` membungkus error → pesan generik ke client, detail ke log (jangan log rahasia — filter). Rate limit: perluas `lib/rateLimit.ts` (sudah ada, in-memory) ke `/api/chat`, `/api/notes/[id]/ask`, `/api/notes/query`, `/api/onboarding/analyze`, `/api/assistant/*` bila belum; catat trade-off in-memory (per-instance) di Risiko.

**7. AI hardening.**
- Perkuat `AI_SAFETY_GUARDRAIL` + prompt per-mode: larangan eksplisit membongkar skema/tabel/isi database, plus aturan bahwa materi adalah data.
- Tutup vektor: auth pada `/api/chat`, `/api/notes/[id]/ask`, `/api/notes/query` (Decision 1) memastikan RAG hanya berjalan atas data pemilik.
- `buildUserContext`/RAG: audit pastikan tidak ada email/user_number/ID internal (sudah dicegah di `lib/profile.ts`), dan tambahkan lapisan verifikasi bila perlu.

## Risks / Trade-offs

- **Rotasi key memutus akses** → Urutan aman: update env produksi dulu, lalu cabut key lama di dashboard. Skrip test gagal sampai env lokal diperbarui — tercatat di tasks.
- **Policy RLS baru memecah fitur** (leaderboard, pencarian teman, quiz rooms) → Semua query lintas-user dipindah ke function definer dalam SQL patch yang sama; daftar fitur terdampak di tasks untuk diregresi-test.
- **CSP memecah inline script/analytics** → Audit inline script (theme di layout) dengan hash; verifikasi visual sebelum merge; jika ada third-party yang butuh inline, gunakan hash/nonce yang tepat, bukan membuka CSP.
- **Rate limit in-memory per-instance** → Pada multi-instance, batas bisa diakali atau salah-hitung; cukup untuk skala saat ini, dicatat sebagai trade-off; migrasi ke Redis bila perlu (di luar scope).
- **Removal fallback auth memecah demo lokal tanpa DB** → Flag dev eksplisit `ALLOW_INSECURE_DEV_AUTH` mempertahankan demo lokal tanpa membahayakan produksi.

## Migration Plan

1. **Sebelum deploy kode**: rotasi key (env produksi diperbarui → key lama dicabut). 2) Apply SQL patch RLS (function definer dibuat sebelum policy baru dicabut-aktifkan dalam satu transaksi). 3) Deploy kode (auth helper, CORS, headers, rate limit). 4) Scrub git history + .gitignore (bisa paralel dengan 3). 5) Regression test penuh (auth matrix, fitur lintas-user, quiz live, share, payments) + secret scan. Rollback: kode lama + env key lama (bila belum dicabut); SQL patch reversible dengan menyimpan policy lama di komentar patch.

## Open Questions

Tidak ada yang memengaruhi scope/approach; semua keputusan tertunda bisa dijawab saat implementasi (mis. detail format CSP hash untuk script pihak ketiga tertentu).