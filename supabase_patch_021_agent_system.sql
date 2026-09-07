-- ============================================================
-- Patch 021 — Eureka Multi Agent System
--
-- 1) agent_call_logs : log observability per panggilan agent
--                     (agent, model, durasi, token, user, iterasi).
-- 2) agent_loop_sessions : state machine loop "Eureka Multi Agent"
--                     yang persisten (tahan refresh/reconnect).
-- 3) agent_loop_iterations : log tiap iterasi loop (goal, pertanyaan,
--                     jawaban, skor, keputusan) untuk evaluasi beta.
--
-- Semua tabel RLS: user hanya bisa melihat data miliknya sendiri;
-- backend memakai service-role (lib/supabase/admin) sehingga bebas
-- menulis untuk user terkait.
-- ============================================================

-- 1) Log panggilan agent -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- kompas | socra | lensa | jejak | palet | kilau (lib/agents/catalog.ts)
    agent_id TEXT NOT NULL CHECK (agent_id IN ('kompas','socra','lensa','jejak','palet','kilau')),
    model TEXT NOT NULL,
    duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
    -- Fitur pemicu: multi-agent-loop | solve-then-guide | chat | dst (bebas).
    source TEXT,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    loop_session_id UUID,
    iteration INTEGER,
    ok BOOLEAN NOT NULL DEFAULT TRUE,
    error TEXT,
    tokens_in INTEGER,
    tokens_out INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_call_logs_agent_idx
    ON public.agent_call_logs(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_call_logs_user_idx
    ON public.agent_call_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_call_logs_session_idx
    ON public.agent_call_logs(loop_session_id) WHERE loop_session_id IS NOT NULL;

ALTER TABLE public.agent_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_call_logs select own" ON public.agent_call_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Log ditulis backend (service-role); user tidak boleh insert/update manual.

-- 2) Sesi loop multi-agent ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_loop_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    -- Sesi chat tempat loop berjalan (ai_chat_sessions.id).
    chat_session_id UUID,
    topic TEXT NOT NULL DEFAULT 'umum',
    -- gather_context | act | observe | reflect | decide | selesai
    phase TEXT NOT NULL DEFAULT 'gather_context' CHECK (phase IN
        ('gather_context','act','observe','reflect','decide','selesai')),
    iteration INTEGER NOT NULL DEFAULT 0,
    -- Batas iterasi saat sesi dibuat (configurable per sesi; default di app).
    max_iterations INTEGER NOT NULL DEFAULT 6 CHECK (max_iterations BETWEEN 1 AND 20),
    goal TEXT,
    mastery INTEGER NOT NULL DEFAULT 50 CHECK (mastery BETWEEN 0 AND 100),
    -- active | stopped | goal_reached | max_iterations | user_stopped | manual_exit
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN
        ('active','stopped','goal_reached','max_iterations','user_stopped','manual_exit')),
    -- Toggle Eureka Multi Agent per sesi (dipertahankan saat ganti topik).
    toggle_on BOOLEAN NOT NULL DEFAULT TRUE,
    -- Kunci idempoten: satu sesi loop aktif per chat session.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_loop_sessions_user_idx
    ON public.agent_loop_sessions(user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS agent_loop_sessions_chat_unique
    ON public.agent_loop_sessions(chat_session_id) WHERE status = 'active';

ALTER TABLE public.agent_loop_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_loop_sessions select own" ON public.agent_loop_sessions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "agent_loop_sessions insert own" ON public.agent_loop_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "agent_loop_sessions update own" ON public.agent_loop_sessions
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "agent_loop_sessions delete own" ON public.agent_loop_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- 3) Iterasi loop --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_loop_iterations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.agent_loop_sessions(id) ON DELETE CASCADE,
    iteration INTEGER NOT NULL CHECK (iteration >= 1),
    goal TEXT,
    -- Pertanyaan/prompt Socra pada iterasi ini.
    question TEXT,
    -- Jawaban siswa (NULL bila loop berhenti sebelum dijawab).
    answer TEXT,
    -- Hasil penilaian Lensa.
    score SMALLINT CHECK (score BETWEEN 0 AND 100),
    verdict TEXT CHECK (verdict IN ('salah','sebagian','benar')),
    mastery_after INTEGER CHECK (mastery_after BETWEEN 0 AND 100),
    -- continue_loop | goal_reached | max_iterations | user_stopped | manual_exit
    decision TEXT CHECK (decision IN
        ('continue_loop','goal_reached','max_iterations','user_stopped','manual_exit')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_loop_iterations_session_idx
    ON public.agent_loop_iterations(session_id, iteration);

ALTER TABLE public.agent_loop_iterations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_loop_iterations select own" ON public.agent_loop_iterations
    FOR SELECT USING (
        auth.uid() = (SELECT user_id FROM public.agent_loop_sessions s WHERE s.id = session_id)
    );
