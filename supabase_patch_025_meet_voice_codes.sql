BEGIN;
ALTER TABLE public.study_meet_rooms ADD COLUMN IF NOT EXISTS code text NOT NULL DEFAULT upper(encode(gen_random_bytes(6),'hex'));
CREATE UNIQUE INDEX IF NOT EXISTS study_meet_code_idx ON public.study_meet_rooms(code);
ALTER TABLE public.study_meet_rooms ADD COLUMN IF NOT EXISTS voice_client uuid;
ALTER TABLE public.study_meet_rooms ADD COLUMN IF NOT EXISTS voice_provider text;
COMMIT;
