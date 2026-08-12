-- ============================================================
-- PATCH 001: perbaikan signup & keunikan username
-- Jalankan di Supabase Dashboard > SQL Editor (idempotent).
-- ============================================================

-- 1) Trigger sync_user & fill_user_number berjalan sebagai OWNER (bypass RLS),
--    tanpa ini auth.createUser gagal: "Database error saving new user".
CREATE OR REPLACE FUNCTION public.sync_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.users (id, email, name, user_number)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name',
            nextval('public.users_number_seq'))
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        name = EXCLUDED.name,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fill_user_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.user_number IS NULL THEN
        NEW.user_number = nextval('public.users_number_seq');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_user();

DROP TRIGGER IF EXISTS on_users_insert ON public.users;
CREATE TRIGGER on_users_insert
    BEFORE INSERT ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION fill_user_number();

-- 2) Pastikan satu @username hanya untuk satu akun (jaga-jaga bila tabel
--    dibuat dari versi schema lama tanpa UNIQUE).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_username_key' AND conrelid = 'public.users'::regclass
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_username_uniq' AND conrelid = 'public.users'::regclass
    ) THEN
        ALTER TABLE public.users
        ADD CONSTRAINT users_username_uniq UNIQUE (username);
    END IF;
END $$;

-- 3) Cari user lama yang baris profilnya hilang akibat bug trigger (mis. akun #1).
INSERT INTO public.users (id, email, name)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.users p WHERE p.id = u.id);

-- 4) Sinkronkan ulang email/nama akun yang sudah ada.
UPDATE public.users p
SET email = u.email,
    name = COALESCE(u.raw_user_meta_data->>'name', p.name)
FROM auth.users u
WHERE p.id = u.id;
