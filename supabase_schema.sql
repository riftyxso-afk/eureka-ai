-- ============================================================
-- Eureka.AI — Supabase Database Schema (LENGKAP)
-- Jalankan sekali di Supabase Dashboard > SQL Editor
-- ============================================================

-- 1) VECTOR EXTENSION (untuk embedding RAG)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2) PROFILE USER (sinkron otomatis dari auth.users lewat trigger)
CREATE SEQUENCE IF NOT EXISTS public.users_number_seq START 1;

CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    username TEXT UNIQUE,
    user_number INT UNIQUE,
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    profile_data JSONB,
    profile_md TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX users_email_idx ON public.users(email);
CREATE INDEX users_username_idx ON public.users(username);

-- ============================================================
-- CATATAN & RAG
-- ============================================================
CREATE TABLE public.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    subject TEXT,
    chapters JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX notes_user_id_idx ON public.notes(user_id);
CREATE INDEX notes_subject_idx ON public.notes(subject);

CREATE TABLE public.chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    chapter_id INT NOT NULL DEFAULT 0,
    text TEXT NOT NULL,
    embedding VECTOR(1536),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX chunks_note_id_idx ON public.chunks(note_id);

-- Fungsi pencarian vektor
-- NOTE: kolom hasil dinamai note_uid dan parameter dinamai p_note_id
-- agar tidak bentrok (error 42P13/42703).
CREATE OR REPLACE FUNCTION public.match_chunks(
    query_embedding VECTOR(1536),
    p_note_id UUID DEFAULT NULL,
    similarity_threshold FLOAT8 DEFAULT 0.78,
    top_k INT DEFAULT 4,
    filter_user_id UUID DEFAULT NULL
) RETURNS TABLE (
    id UUID,
    note_uid UUID,
    chapter_id INT,
    text TEXT,
    embedding VECTOR,
    similarity FLOAT8
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.note_id,
        c.chapter_id,
        c.text,
        c.embedding,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM public.chunks c
    WHERE 1=1
      AND (p_note_id IS NULL OR c.note_id = p_note_id)
      AND (filter_user_id IS NULL
           OR EXISTS (
               SELECT 1 FROM public.notes n
               WHERE n.id = c.note_id AND n.user_id = filter_user_id
           ))
      AND 1 - (c.embedding <=> query_embedding) > similarity_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT top_k;
END;
$$;

-- ============================================================
-- KOLABORASI (presence, chat, versi, undangan)
-- ============================================================
CREATE TABLE public.presence (
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
    last_active BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (note_id, user_id)
);

CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL,
    content TEXT NOT NULL,
    parent_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
    is_ai BOOLEAN DEFAULT FALSE,
    mentions TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX chat_messages_parent_idx ON public.chat_messages(parent_id);
CREATE INDEX chat_messages_note_idx ON public.chat_messages(note_id, created_at DESC);

CREATE TABLE public.note_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(note_id, version_number)
);

CREATE TABLE public.invite_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE,
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    invitee_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE public.collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(note_id, user_id)
);

-- ============================================================
-- DOKUMEN & PEKERJAAN BACKGROUND
-- ============================================================
CREATE TABLE public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    source_type TEXT NOT NULL CHECK (source_type IN ('pdf', 'web', 'drive')),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX documents_status_idx ON public.documents(status);

CREATE TABLE public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID REFERENCES public.notes(id) ON DELETE CASCADE,
    progress INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    message TEXT,
    result JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX jobs_note_id_idx ON public.jobs(note_id);
CREATE INDEX jobs_status_idx ON public.jobs(status);

-- ============================================================
-- MATA PELAJARAN
-- ============================================================
CREATE TABLE public.subjects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    icon TEXT,
    color TEXT,
    progress INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.subjects (id, name, icon, color, progress) VALUES
    ('s-mtk', 'Matematika', '🧮', '#8B5CF6', 75),
    ('s-fis', 'Fisika', '⚡', '#F59E0B', 60),
    ('s-kim', 'Kimia', '🧪', '#10B981', 45),
    ('s-bio', 'Biologi', '🧬', '#3B82F6', 30),
    ('s-eko', 'Ekonomi', '📊', '#EF4444', 20),
    ('s-sej', 'Sejarah', '📜', '#8B5CF6', 10)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- CATATAN PRIBADI PER BAB (notes pribadi user di halaman bab)
-- ============================================================
CREATE TABLE public.chapter_notes (
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    chapter_id INT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (note_id, chapter_id)
);

-- ============================================================
-- PROGRES BELAJAR (XP, streak, kartu hafalan, log aktivitas)
-- ============================================================
CREATE TABLE public.progress (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    xp INT NOT NULL DEFAULT 0,
    active_days TEXT[] NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    xp INT NOT NULL DEFAULT 0,
    label TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX activity_log_user_idx ON public.activity_log(user_id, created_at DESC);

CREATE TABLE public.flashcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    review_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX flashcards_user_due_idx ON public.flashcards(user_id, due_date);

-- ============================================================
-- UJIAN
-- ============================================================
CREATE TABLE public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'completed')),
    score INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX exams_user_date_idx ON public.exams(user_id, date);

-- ============================================================
-- TEMAN
-- ============================================================
CREATE TABLE public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    to_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (from_id <> to_id)
);

CREATE UNIQUE INDEX friendships_pair_idx
    ON public.friendships (LEAST(from_id, to_id), GREATEST(from_id, to_id));

-- ============================================================
-- HIGHLIGHT & GAMBAR CATATAN
-- ============================================================
CREATE TABLE public.highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    chapter_id INT NOT NULL DEFAULT 0,
    text TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'yellow' CHECK (color IN ('yellow', 'pink', 'blue')),
    user_id TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX highlights_note_idx ON public.highlights(note_id, chapter_id);

CREATE TABLE public.note_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    chapter_id INT,
    url TEXT NOT NULL,
    caption TEXT,
    alignment TEXT NOT NULL DEFAULT 'center' CHECK (alignment IN ('left', 'center', 'right')),
    size TEXT NOT NULL DEFAULT 'medium' CHECK (size IN ('small', 'medium', 'large')),
    source TEXT NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'web')),
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX note_images_note_idx ON public.note_images(note_id);

-- ============================================================
-- NOTIFIKASI
-- ============================================================
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('friend_request', 'friend_accepted', 'mention', 'achievement', 'note_ready')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);

-- ============================================================
-- KUIS & FLASHCARDS PER CATATAN
-- ============================================================
CREATE TABLE public.study_content (
    note_id UUID PRIMARY KEY REFERENCES public.notes(id) ON DELETE CASCADE,
    quizzes JSONB NOT NULL DEFAULT '[]'::jsonb,
    flashcards JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PAPAN TULIS KOLABORATIF
-- ============================================================
CREATE TABLE public.whiteboards (
    note_id UUID PRIMARY KEY REFERENCES public.notes(id) ON DELETE CASCADE,
    cleared_at BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.board_strokes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    size REAL NOT NULL DEFAULT 3,
    points JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX board_strokes_note_idx ON public.board_strokes(note_id);

-- ============================================================
-- TRIGGER: updated_at otomatis
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notes_timestamp BEFORE UPDATE ON public.notes
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER update_documents_timestamp BEFORE UPDATE ON public.documents
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER update_jobs_timestamp BEFORE UPDATE ON public.jobs
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER update_users_timestamp BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER update_progress_timestamp BEFORE UPDATE ON public.progress
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER update_study_content_timestamp BEFORE UPDATE ON public.study_content
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER update_whiteboards_timestamp BEFORE UPDATE ON public.whiteboards
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- TRIGGER: user baru dari auth.users → public.users
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.users (id, email, name, user_number)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name',
            nextval('public.users_number_seq'))
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        name = EXCLUDED.name,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_user();

-- Trigger pendukung: nomor urut user dijamin terisi untuk data lama.
CREATE OR REPLACE FUNCTION public.fill_user_number()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.user_number IS NULL THEN
        NEW.user_number = nextval('public.users_number_seq');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_users_insert ON public.users;
CREATE TRIGGER on_users_insert
    BEFORE INSERT ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION fill_user_number();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whiteboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_strokes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_notes ENABLE ROW LEVEL SECURITY;

-- ---------- Profil & progres (akses data sendiri) ----------
CREATE POLICY "users select own" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users update own" ON public.users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "progress select own" ON public.progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "progress insert own" ON public.progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "progress update own" ON public.progress FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "activity select own" ON public.activity_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "activity insert own" ON public.activity_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "activity delete own" ON public.activity_log FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "flashcards select own" ON public.flashcards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "flashcards insert own" ON public.flashcards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "flashcards update own" ON public.flashcards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "flashcards delete own" ON public.flashcards FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "exams select own" ON public.exams FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "exams insert own" ON public.exams FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "exams update own" ON public.exams FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "exams delete own" ON public.exams FOR DELETE USING (auth.uid() = user_id);

-- ---------- Teman (lihat profil & permintaan antar pengguna) ----------
CREATE POLICY "search other users" ON public.users FOR SELECT USING (
    auth.uid() IS NOT NULL
);

CREATE POLICY "friendships select" ON public.friendships FOR SELECT USING (
    auth.uid() IN (from_id, to_id)
);
CREATE POLICY "friendships insert" ON public.friendships FOR INSERT WITH CHECK (
    auth.uid() IN (from_id, to_id)
);
CREATE POLICY "friendships update" ON public.friendships FOR UPDATE USING (
    auth.uid() IN (from_id, to_id)
);
CREATE POLICY "friendships delete" ON public.friendships FOR DELETE USING (
    auth.uid() IN (from_id, to_id)
);

-- ---------- Catatan (akses catatan sendiri) ----------
CREATE POLICY "notes select own" ON public.notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notes insert own" ON public.notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notes update own" ON public.notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notes delete own" ON public.notes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "chunks select own" ON public.chunks FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = chunks.note_id AND n.user_id = auth.uid())
);
CREATE POLICY "chunks insert own" ON public.chunks FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = chunks.note_id AND n.user_id = auth.uid())
);
CREATE POLICY "chunks delete own" ON public.chunks FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = chunks.note_id AND n.user_id = auth.uid())
);

CREATE POLICY "chat select own" ON public.chat_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = chat_messages.note_id AND n.user_id = auth.uid())
);
CREATE POLICY "chat insert own" ON public.chat_messages FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = chat_messages.note_id AND n.user_id = auth.uid())
);

CREATE POLICY "versions select own" ON public.note_versions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_versions.note_id AND n.user_id = auth.uid())
);
CREATE POLICY "versions insert own" ON public.note_versions FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_versions.note_id AND n.user_id = auth.uid())
);

CREATE POLICY "presence select own" ON public.presence FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = presence.note_id AND n.user_id = auth.uid())
);
CREATE POLICY "presence insert own" ON public.presence FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = presence.note_id AND n.user_id = auth.uid())
);
CREATE POLICY "presence update own" ON public.presence FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = presence.note_id AND n.user_id = auth.uid())
);
CREATE POLICY "presence delete own" ON public.presence FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = presence.note_id AND n.user_id = auth.uid())
);

-- ---------- Highlight & gambar (akses catatan sendiri) ----------
CREATE POLICY "highlights select own" ON public.highlights FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = highlights.note_id AND n.user_id = auth.uid())
);
CREATE POLICY "highlights insert own" ON public.highlights FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = highlights.note_id AND n.user_id = auth.uid())
);
CREATE POLICY "highlights delete own" ON public.highlights FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = highlights.note_id AND n.user_id = auth.uid())
);

CREATE POLICY "images select own" ON public.note_images FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_images.note_id AND n.user_id = auth.uid())
);
CREATE POLICY "images insert own" ON public.note_images FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_images.note_id AND n.user_id = auth.uid())
);
CREATE POLICY "images delete own" ON public.note_images FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_images.note_id AND n.user_id = auth.uid())
);

-- ---------- Notifikasi (hanya punya sendiri) ----------
CREATE POLICY "notifications select own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications insert own" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notifications update own" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- ---------- Studi (kuis & flashcards per catatan) ----------
CREATE POLICY "study select own" ON public.study_content FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = study_content.note_id AND n.user_id = auth.uid())
);
CREATE POLICY "study upsert own" ON public.study_content FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = study_content.note_id AND n.user_id = auth.uid())
);
CREATE POLICY "study update own" ON public.study_content FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = study_content.note_id AND n.user_id = auth.uid())
);

-- ---------- Papan tulis ----------
CREATE POLICY "whiteboards select own" ON public.whiteboards FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = whiteboards.note_id AND n.user_id = auth.uid())
);
CREATE POLICY "whiteboards insert own" ON public.whiteboards FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = whiteboards.note_id AND n.user_id = auth.uid())
);
CREATE POLICY "whiteboards update own" ON public.whiteboards FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = whiteboards.note_id AND n.user_id = auth.uid())
);

CREATE POLICY "strokes select own" ON public.board_strokes FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = board_strokes.note_id AND n.user_id = auth.uid())
);
CREATE POLICY "strokes insert own" ON public.board_strokes FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = board_strokes.note_id AND n.user_id = auth.uid())
);
CREATE POLICY "strokes delete own" ON public.board_strokes FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = board_strokes.note_id AND n.user_id = auth.uid())
);

CREATE POLICY "chapter_notes select own" ON public.chapter_notes FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = chapter_notes.note_id AND n.user_id = auth.uid())
);
CREATE POLICY "chapter_notes upsert own" ON public.chapter_notes FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = chapter_notes.note_id AND n.user_id = auth.uid())
);
CREATE POLICY "chapter_notes update own" ON public.chapter_notes FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.notes n WHERE n.id = chapter_notes.note_id AND n.user_id = auth.uid())
);

CREATE TRIGGER update_chapter_notes_timestamp BEFORE UPDATE ON public.chapter_notes
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ---------- Dokumen & pekerjaan ----------
CREATE POLICY "documents select own" ON public.documents FOR SELECT USING (
    auth.uid() IS NOT NULL
);

CREATE POLICY "jobs select own" ON public.jobs FOR SELECT USING (
    EXISTS (SELECT 1 FROM notes n WHERE n.id = jobs.note_id AND n.user_id = auth.uid())
);

-- ---------- Mata pelajaran (publik) ----------
CREATE POLICY "subjects public read" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "subjects insert" ON public.subjects FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "subjects delete" ON public.subjects FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- REALTIME (untuk polling & subscription)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.board_strokes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whiteboards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
