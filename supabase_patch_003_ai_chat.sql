-- ============================================================
-- Eureka.AI - Patch 003: Tabel Chat Asisten AI (halaman /asisten)
-- Riwayat percakapan dengan asisten AI yang punya akses ke semua
-- data user (catatan, bab, subjek, progres).
-- Jalankan sekali di Supabase Dashboard > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Percakapan baru',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_chat_sessions_user_idx
    ON public.ai_chat_sessions (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    mentions JSONB NOT NULL DEFAULT '[]'::jsonb,
    sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    model TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_chat_messages_session_idx
    ON public.ai_chat_messages (session_id, created_at);

CREATE OR REPLACE FUNCTION public.touch_ai_chat_session()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.ai_chat_sessions
    SET updated_at = NOW()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_chat_messages_touch_session
    ON public.ai_chat_messages;
CREATE TRIGGER ai_chat_messages_touch_session
    AFTER INSERT ON public.ai_chat_messages
    FOR EACH ROW EXECUTE FUNCTION public.touch_ai_chat_session();

ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_chat_sessions user select" ON public.ai_chat_sessions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ai_chat_sessions user insert" ON public.ai_chat_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_chat_sessions user update" ON public.ai_chat_sessions
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_chat_sessions user delete" ON public.ai_chat_sessions
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "ai_chat_messages user select" ON public.ai_chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.ai_chat_sessions s
            WHERE s.id = ai_chat_messages.session_id AND s.user_id = auth.uid()
        )
    );
CREATE POLICY "ai_chat_messages user insert" ON public.ai_chat_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.ai_chat_sessions s
            WHERE s.id = ai_chat_messages.session_id AND s.user_id = auth.uid()
        )
    );
CREATE POLICY "ai_chat_messages service role" ON public.ai_chat_messages
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');