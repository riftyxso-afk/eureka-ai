BEGIN;
CREATE TABLE IF NOT EXISTS public.study_meet_rooms (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES auth.users(id),
 title text NOT NULL CHECK(char_length(title) BETWEEN 3 AND 100), invite text NOT NULL DEFAULT encode(gen_random_bytes(24),'hex'),
 board text NOT NULL DEFAULT '', board_open boolean NOT NULL DEFAULT false,
 ai_busy_until timestamptz NOT NULL DEFAULT '1970-01-01', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.study_meet_members (
 id uuid PRIMARY KEY, room_id uuid NOT NULL REFERENCES public.study_meet_rooms(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id), name text NOT NULL, seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.study_meet_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, room_id uuid NOT NULL REFERENCES public.study_meet_rooms(id) ON DELETE CASCADE,
 sender uuid NOT NULL, recipient uuid, kind text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS study_meet_events_room ON public.study_meet_events(room_id,id);
CREATE INDEX IF NOT EXISTS study_meet_members_room ON public.study_meet_members(room_id,seen_at);
ALTER TABLE public.study_meet_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_meet_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_meet_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.study_meet_rooms, public.study_meet_members, public.study_meet_events FROM anon, authenticated;
GRANT ALL ON public.study_meet_rooms, public.study_meet_members, public.study_meet_events TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.study_meet_events_id_seq TO service_role;
CREATE OR REPLACE FUNCTION public.join_study_meet(p_room uuid,p_user uuid,p_client uuid,p_invite text,p_name text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(p_room::text));
 IF NOT EXISTS(SELECT 1 FROM study_meet_rooms WHERE id=p_room AND invite=p_invite) THEN RAISE EXCEPTION 'Invalid invitation'; END IF;
 IF EXISTS(SELECT 1 FROM study_meet_members WHERE id=p_client AND (user_id<>p_user OR room_id<>p_room)) THEN RAISE EXCEPTION 'Invalid client'; END IF;
 IF NOT EXISTS(SELECT 1 FROM study_meet_members WHERE id=p_client AND seen_at>now()-interval '45 seconds') AND (SELECT count(*) FROM study_meet_members WHERE room_id=p_room AND seen_at>now()-interval '45 seconds')>=6 THEN RAISE EXCEPTION 'Room full'; END IF;
 INSERT INTO study_meet_members(id,room_id,user_id,name) VALUES(p_client,p_room,p_user,left(p_name,60)) ON CONFLICT(id) DO UPDATE SET seen_at=now(),name=excluded.name;
END $$;
REVOKE ALL ON FUNCTION public.join_study_meet(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.join_study_meet(uuid,uuid,uuid,text,text) TO service_role;
COMMIT;
