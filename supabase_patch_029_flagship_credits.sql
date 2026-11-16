BEGIN;

CREATE TABLE IF NOT EXISTS public.assistant_flagship_credits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  remaining integer NOT NULL DEFAULT 100 CHECK (remaining BETWEEN 0 AND 100)
);

ALTER TABLE public.assistant_flagship_credits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assistant_flagship_credits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.assistant_flagship_credits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_assistant_flagship_credit(p_user_id uuid)
RETURNS integer
LANGUAGE sql
SET search_path = ''
AS $$
  INSERT INTO public.assistant_flagship_credits AS credits (user_id, remaining)
  VALUES (p_user_id, 99)
  ON CONFLICT (user_id) DO UPDATE
    SET remaining = credits.remaining - 1
    WHERE credits.remaining > 0
  RETURNING remaining;
$$;

REVOKE ALL ON FUNCTION public.consume_assistant_flagship_credit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_assistant_flagship_credit(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';

COMMIT;
