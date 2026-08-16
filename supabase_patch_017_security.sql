-- ============================================================
-- Eureka.AI - Patch 017: Hardening RLS & security functions
--
-- 1. users   : SELECT policy dibatasi ke baris sendiri (sebelumnya
--              semua user login bisa membaca KOLOM APA PUN user lain:
--              email, profile_data, user_number, dsb).
-- 2. documents: policy SELECT terbuka (auth.uid() IS NOT NULL) diganti
--              kepemilikan; tambahkan kolom user_id (tabel tidak dipakai
--              kode apa pun — aman ditambah).
-- 3. quiz_rooms / quiz_room_participants: policy SELECT USING(true) dihapus;
--              akses publik lewat function SECURITY DEFINER yang TIDAK
--              mengembalikan host_key / participant_key / answers.
-- 4. Function search_users(q) & get_leaderboard() — hanya kolom publik.
--
-- Server memakai service-role (bypass RLS), jadi perubahan ini tidak
-- memengaruhi fungsi aplikasi; ini menutup akses langsung via anon key.
--
-- SCRIPT INI IDEMPOTEN & ATOMIK:
--   - Dibungkus BEGIN/COMMIT → bila ada statement gagal, SEMUA di-rollback
--     (tidak ada lagi keadaan parsial seperti run sebelumnya).
--   - Setiap policy di-DROP eksplisit (IF EXISTS) sebelum dibuat ulang,
--     jadi aman dijalankan ulang berapa kali pun.
-- Jalankan SEKALI utuh di Supabase Dashboard > SQL Editor.
-- ============================================================

BEGIN;

-- ─── 1. users: hanya baris sendiri ───────────────────────────
DROP POLICY IF EXISTS "search other users" ON public.users;
DROP POLICY IF EXISTS "users select own" ON public.users;
CREATE POLICY "users select own" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- ─── 2. documents: kepemilikan ───────────────────────────────
ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "documents select own" ON public.documents;
CREATE POLICY "documents select own" ON public.documents
    FOR SELECT USING (auth.uid() = user_id);

-- ─── 3. quiz rooms: tutup SELECT terbuka ─────────────────────
DROP POLICY IF EXISTS "quiz_rooms public select" ON public.quiz_rooms;
DROP POLICY IF EXISTS "quiz_room_participants public select" ON public.quiz_room_participants;

-- 3a. Ambil ruang by token — TANPA host_key.
CREATE OR REPLACE FUNCTION public.get_quiz_room_by_token(p_token TEXT)
RETURNS TABLE (
    id UUID,
    token TEXT,
    status TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id, token, status, created_at
    FROM public.quiz_rooms
    WHERE token = p_token;
$$;

-- 3b. Ambil partisipan ruang by room token — TANPA participant_key & answers.
CREATE OR REPLACE FUNCTION public.get_participant_by_token(p_token TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    is_host BOOLEAN,
    score SMALLINT,
    submitted_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p.id, p.name, p.is_host, p.score, p.submitted_at
    FROM public.quiz_room_participants p
    JOIN public.quiz_rooms r ON r.id = p.room_id
    WHERE r.token = p_token;
$$;

-- ─── 4. Function profil publik ───────────────────────────────
-- 4a. Cari pengguna untuk fitur teman — hanya id, name, username.
CREATE OR REPLACE FUNCTION public.search_users(q TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    username TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.id, u.name, u.username
    FROM public.users u
    WHERE q = ''
       OR u.name ILIKE '%' || q || '%'
       OR u.username ILIKE '%' || q || '%'
    ORDER BY u.name
    LIMIT 20;
$$;

-- 4b. Leaderboard — XP dari tabel progress, tanpa email/profile_data.
CREATE OR REPLACE FUNCTION public.get_leaderboard()
RETURNS TABLE (
    id UUID,
    name TEXT,
    username TEXT,
    xp BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT u.id, u.name, u.username, COALESCE(p.xp, 0)::BIGINT AS xp
    FROM public.users u
    LEFT JOIN public.progress p ON p.user_id = u.id
    ORDER BY xp DESC, u.name
    LIMIT 50;
$$;

-- ─── Hak akses: authenticated boleh EXECUTE (service-role otomatis) ──
GRANT EXECUTE ON FUNCTION public.get_quiz_room_by_token(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_participant_by_token(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_users(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO authenticated;

COMMIT;

-- ─── Verifikasi (setelah COMMIT): tidak boleh ada policy SELECT USING(true) tersisa ──
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd = 'SELECT'
  AND qual = 'true';