CREATE TABLE IF NOT EXISTS public.ai_training_samples (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 session_id uuid REFERENCES public.ai_chat_sessions(id) ON DELETE SET NULL,
 message_id uuid, prompt text NOT NULL CHECK(length(prompt)<=12000),completion text NOT NULL CHECK(length(completion)<=20000),
 sample_hash text NOT NULL,consent_version text NOT NULL,consent_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'consented' CHECK(status IN ('consented','reviewed','training','trained')),
 UNIQUE(user_id,sample_hash)
);
ALTER TABLE public.ai_training_samples ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_training_samples FROM anon,authenticated;
GRANT ALL ON public.ai_training_samples TO service_role;
CREATE INDEX IF NOT EXISTS ai_training_samples_owner ON public.ai_training_samples(user_id,consent_at DESC);
