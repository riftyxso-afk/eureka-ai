CREATE TABLE IF NOT EXISTS public.ai_learning_preferences (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false, consent_at timestamptz, consent_version text,
 style text NOT NULL DEFAULT 'auto' CHECK(style IN ('auto','simple','detailed','visual')),
 counts jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_learning_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_learning_preferences FROM anon,authenticated;
GRANT ALL ON public.ai_learning_preferences TO service_role;
CREATE OR REPLACE FUNCTION public.observe_ai_learning(p_user uuid,p_kind text) RETURNS boolean
 LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF p_kind NOT IN ('answer','mindmap','quiz','essay','document') THEN RETURN false; END IF;
 UPDATE public.ai_learning_preferences SET counts=jsonb_set(counts,ARRAY[p_kind],to_jsonb(least(100000,coalesce((counts->>p_kind)::int,0)+1))),updated_at=now()
 WHERE user_id=p_user AND enabled=true;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.observe_ai_learning(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.observe_ai_learning(uuid,text) TO service_role;
CREATE TABLE IF NOT EXISTS public.study_artifacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 session_id uuid NOT NULL REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(length(title)<=120),content text NOT NULL CHECK(length(content)<=60000),
 revision integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS study_artifacts_owner_session ON public.study_artifacts(user_id,session_id);
ALTER TABLE public.study_artifacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.study_artifacts FROM anon,authenticated;
GRANT ALL ON public.study_artifacts TO service_role;
