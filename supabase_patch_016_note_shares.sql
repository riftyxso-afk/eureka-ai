-- ============================================================
-- PATCH 016: SHARE CATATAN PUBLIK (READ-ONLY)
-- ------------------------------------------------------------
-- Tabel note_shares menyimpan token unik per catatan yang
-- dibagikan via link publik. Halaman /share/note/[token] memakai
-- fungsi security definer get_public_note_by_token() untuk
-- membaca judul + bab catatan TANPA login — RLS tabel lain tetap
-- melindungi data.
--
-- IDEMPOTEN — aman dijalankan ulang.
-- ============================================================

-- 1) Tabel note_shares (jika belum ada)
CREATE TABLE IF NOT EXISTS public.note_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) RLS: hanya service/owner yang menulis via app; baris read-only
--    untuk publik melalui fungsi definer (bukan SELECT langsung).
ALTER TABLE public.note_shares ENABLE ROW LEVEL SECURITY;

-- Owner (pemilik catatan) boleh membuat/melihat share milik catatannya.
DROP POLICY IF EXISTS "owner_insert_note_shares" ON public.note_shares;
CREATE POLICY "owner_insert_note_shares"
    ON public.note_shares
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.notes n
            WHERE n.id = note_id
              AND n.user_id = auth.uid()
        )
    );

-- Tidak ada policy SELECT/UPDATE/DELETE untuk role anon — akses
-- publik hanya lewat fungsi security definer di bawah.

-- 3) Fungsi baca publik: kembalikan snapshot read-only (judul + bab).
--    Hanya kolom aman yang diekspos; pencarian token memakai index UNIQUE.
CREATE OR REPLACE FUNCTION public.get_public_note_by_token(p_token TEXT)
RETURNS TABLE (id UUID, title TEXT, chapters JSONB, subject TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT n.id, n.title, n.chapters, n.subject
    FROM public.note_shares s
    JOIN public.notes n ON n.id = s.note_id
    WHERE s.token = p_token
    LIMIT 1;
END;
$$;

-- 4) Grant eksekusi fungsi ke peran anon (halaman share publik tanpa login).
REVOKE ALL ON FUNCTION public.get_public_note_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_note_by_token(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_note_by_token(TEXT) TO authenticated;
