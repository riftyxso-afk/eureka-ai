BEGIN;

CREATE OR REPLACE FUNCTION public.consume_assistant_flagship_credit(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  prompt_cost CONSTANT integer := 15;
  new_balance integer;
BEGIN
  INSERT INTO public.assistant_flagship_credits AS credits (user_id, remaining)
  VALUES (p_user_id, 100 - prompt_cost)
  ON CONFLICT (user_id) DO UPDATE
    SET remaining = credits.remaining - prompt_cost
    WHERE credits.remaining >= prompt_cost
  RETURNING remaining INTO new_balance;

  RETURN new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_assistant_flagship_credit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_assistant_flagship_credit(uuid) TO service_role;

COMMIT;
