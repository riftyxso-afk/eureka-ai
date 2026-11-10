BEGIN;
SET LOCAL lock_timeout = '5s';

-- Profile, billing, beta status, and points are written by the backend.
-- Row ownership alone does not stop clients from changing privileged fields.
DROP POLICY IF EXISTS "users update own" ON public.users;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON TABLE public.users
  FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF has_any_column_privilege('anon', 'public.users', 'INSERT,UPDATE')
    OR has_any_column_privilege('authenticated', 'public.users', 'INSERT,UPDATE')
    OR NOT has_table_privilege('service_role', 'public.users', 'UPDATE') THEN
    RAISE EXCEPTION 'Unexpected grants on public.users';
  END IF;
END
$$;

COMMIT;
