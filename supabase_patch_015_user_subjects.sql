-- ============================================================
-- PATCH 015: MATA PELAJARAN PER-USER
-- ------------------------------------------------------------
-- Mengubah tabel subjects dari GLOBAL (seed + RLS public, semua
-- user melihat/menambah tabel yang sama) menjadi milik per-user:
--   - tambah kolom user_id
--   - hapus subjek global lama (seed & subjek yang tidak punya pemilik)
--   - ganti UNIQUE(name) -> UNIQUE(user_id, name) (dua user boleh
--     punya "Matematika" masing-masing)
--   - RLS baru: SELECT/UPDATE/DELETE hanya milik sendiri, INSERT
--     dengan user_id = auth.uid()
--
-- IDEMPOTEN — aman dijalankan ulang.
-- ============================================================

-- 1) Kolom user_id (jika belum ada)
ALTER TABLE public.subjects
    ADD COLUMN IF NOT EXISTS user_id TEXT;

-- 2) Hapus subjek global lama (tidak tercatat pemiliknya).
--    Catatan lama TIDAK tersentuh — kolom subject di notes adalah
--    teks bebas dan tetap utuh.
DELETE FROM public.subjects
WHERE user_id IS NULL OR user_id = '';

-- 3) Hapus constraint UNIQUE(name) global (jika ada) —
--    drop constraint dengan nama apa pun yang menargetkan name.
DO $$
DECLARE
    con_name TEXT;
BEGIN
    FOR con_name IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.subjects'::regclass
          AND contype = 'u'
          AND conkey = ARRAY[
              (SELECT attnum FROM pg_attribute
               WHERE attrelid = 'public.subjects'::regclass AND attname = 'name')
          ]::smallint[]
    LOOP
        EXECUTE format('ALTER TABLE public.subjects DROP CONSTRAINT %I', con_name);
    END LOOP;
END $$;

-- 4) Constraint unik per-user (name unik dalam scope user yang sama)
ALTER TABLE public.subjects
    ADD CONSTRAINT subjects_user_name_unique UNIQUE (user_id, name);

-- 5) Hapus policy RLS lama (jika ada)
DROP POLICY IF EXISTS "subjects public read" ON public.subjects;
DROP POLICY IF EXISTS "subjects insert" ON public.subjects;
DROP POLICY IF EXISTS "subjects delete" ON public.subjects;
DROP POLICY IF EXISTS "subjects update" ON public.subjects;

-- 6) RLS aktif + policy per-user
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subjects select own"
    ON public.subjects FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "subjects insert own"
    ON public.subjects FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "subjects update own"
    ON public.subjects FOR UPDATE
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "subjects delete own"
    ON public.subjects FOR DELETE
    USING (auth.uid()::text = user_id);

-- 7) Indeks untuk lookup per-user
CREATE INDEX IF NOT EXISTS subjects_user_id_idx ON public.subjects(user_id);
