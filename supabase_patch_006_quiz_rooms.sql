-- ============================================================
-- Eureka.AI - Patch 006: Kuis Share & Live Room
-- (quiz_shares, quiz_rooms, quiz_room_participants)
--
-- - quiz_shares: snapshot soal kuis yang dibagikan via link publik
--   (token s_*), view-only. Penerima tidak perlu login.
-- - quiz_rooms: ruang live dari sebuah share; token r_*, status
--   lobby → live → ended; host_key = otorisasi host (mulai/akhiri).
-- - quiz_room_participants: partisipan ruang (termasuk host). Nama
--   unik per room; participant_key = otorisasi submit. Satu submit
--   per partisipan (submitted_at NULL di-enforce di aplikasi).
--
-- Realtime: quiz_room_participants ditambahkan ke publication
-- supabase_realtime agar leaderboard ter-update otomatis.
-- Jalankan sekali di Supabase Dashboard > SQL Editor
-- ============================================================

-- Snapshot kuis yang dibagikan (token s_*)
CREATE TABLE IF NOT EXISTS public.quiz_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Token publik: diawali "s_" + acak (unix).
    token TEXT NOT NULL UNIQUE,
    -- Catatan asal (referensi; snapshot soal tetap di questions).
    note_id UUID NOT NULL,
    -- Judul catatan sebagai snapshot (judul bisa berubah di catatan asli).
    note_title TEXT NOT NULL DEFAULT '',
    -- Snapshot soal: [{id, question, options[], answer, explanation}].
    questions JSONB NOT NULL,
    -- Pemilik share (auth user id).
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS quiz_shares_created_by_idx
    ON public.quiz_shares (created_by);

-- Ruang live dari sebuah share (token r_*)
CREATE TABLE IF NOT EXISTS public.quiz_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Token publik: diawali "r_" + acak.
    token TEXT NOT NULL UNIQUE,
    -- Share yang menjadi sumber soal.
    share_id UUID NOT NULL REFERENCES public.quiz_shares (id) ON DELETE CASCADE,
    -- Otorisasi host: hanya yang tahu host_key boleh mulai/mengakhiri.
    host_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'lobby'
        CHECK (status IN ('lobby', 'live', 'ended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS quiz_rooms_status_idx
    ON public.quiz_rooms (status);

-- Partisipan ruang (termasuk host). Nama unik per room.
CREATE TABLE IF NOT EXISTS public.quiz_room_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.quiz_rooms (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    -- Otorisasi submit (acak, disimpan sessionStorage client).
    participant_key TEXT NOT NULL UNIQUE,
    is_host BOOLEAN NOT NULL DEFAULT false,
    -- Jawaban: {questionId: indeksOpsi}; satu submit per partisipan.
    answers JSONB,
    score SMALLINT,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (room_id, name)
);

CREATE INDEX IF NOT EXISTS quiz_room_participants_room_idx
    ON public.quiz_room_participants (room_id);

-- ─── Realtime untuk leaderboard ─────────────────────────────
-- Perubahan baris partisipan (join/submit) langsung dikirim ke
-- klien ruang via Supabase Realtime (postgres_changes, filter room_id).
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_room_participants;

-- ─── RLS ────────────────────────────────────────────────────
-- Praktiknya akses lewat service-role di server (lib/supabase/admin);
-- policy ini lapisan belakang untuk akses langsung.
ALTER TABLE public.quiz_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_room_participants ENABLE ROW LEVEL SECURITY;

-- Share: hanya pemilik yang boleh melihat/membuat.
CREATE POLICY "quiz_shares owner select" ON public.quiz_shares
    FOR SELECT USING (created_by = auth.uid());
CREATE POLICY "quiz_shares owner insert" ON public.quiz_shares
    FOR INSERT WITH CHECK (created_by = auth.uid());

-- Room & partisipan: publik bisa MEMBACA (room bersifat live/publik);
-- menulis hanya lewat service-role (server) sehingga tidak ada policy tulis.
CREATE POLICY "quiz_rooms public select" ON public.quiz_rooms
    FOR SELECT USING (true);
CREATE POLICY "quiz_room_participants public select" ON public.quiz_room_participants
    FOR SELECT USING (true);