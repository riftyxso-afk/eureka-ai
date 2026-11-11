BEGIN;

CREATE TABLE IF NOT EXISTS public.study_research_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.study_research_members (
  project_id uuid NOT NULL REFERENCES public.study_research_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.study_research_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.study_research_projects(id) ON DELETE CASCADE,
  url text NOT NULL CHECK (char_length(url) <= 300),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 230),
  excerpt text NOT NULL CHECK (char_length(excerpt) <= 1100),
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, url)
);

CREATE INDEX IF NOT EXISTS study_research_owner_idx ON public.study_research_projects(owner_id);
CREATE INDEX IF NOT EXISTS study_research_member_idx ON public.study_research_members(user_id);

ALTER TABLE public.study_research_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_research_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_research_papers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.study_research_projects, public.study_research_members, public.study_research_papers FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_research_projects, public.study_research_members, public.study_research_papers TO service_role;

COMMIT;
