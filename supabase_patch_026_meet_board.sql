-- Atomic document save without placing a potentially large original in a URL.
CREATE OR REPLACE FUNCTION public.save_study_meet_board(p_room uuid, p_original text, p_content text)
RETURNS boolean LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF length(p_content) > 60000 OR p_content IS NULL OR p_original IS NULL THEN
    RAISE EXCEPTION 'Invalid board content';
  END IF;
  UPDATE public.study_meet_rooms SET board = p_content
  WHERE id = p_room AND board = p_original AND ai_busy_until < now();
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.save_study_meet_board(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_study_meet_board(uuid,text,text) TO service_role;
