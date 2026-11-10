BEGIN;

CREATE TABLE IF NOT EXISTS public.mayar_payment_requests (
  order_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mayar_id uuid UNIQUE,
  transaction_id uuid UNIQUE,
  amount integer NOT NULL CHECK (amount > 0),
  tier text NOT NULL CHECK (tier IN ('promo', 'normal')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mayar_payment_requests_user_idx
  ON public.mayar_payment_requests (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS mayar_payment_requests_free_code_idx
  ON public.mayar_payment_requests (user_id) WHERE amount = 500;

ALTER TABLE public.mayar_payment_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mayar_payment_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mayar_payment_requests TO service_role;

CREATE OR REPLACE FUNCTION public.settle_mayar_checkout(p_order_id uuid, p_mayar_id uuid, p_amount integer)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  checkout public.mayar_payment_requests%ROWTYPE;
BEGIN
  SELECT * INTO checkout FROM public.mayar_payment_requests
    WHERE order_id = p_order_id AND mayar_id = p_mayar_id AND amount = p_amount
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF checkout.status = 'paid' THEN
    RETURN true;
  END IF;

  UPDATE public.users
    SET is_premium = true, premium_tier = checkout.tier,
        premium_until = greatest(now(), premium_until) + interval '30 days'
    WHERE id = checkout.user_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.mayar_payment_requests SET status = 'paid', paid_at = now()
    WHERE order_id = checkout.order_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_mayar_checkout(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_mayar_checkout(uuid, uuid, integer) TO service_role;
COMMIT;
