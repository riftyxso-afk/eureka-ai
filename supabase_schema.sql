-- ============================================
-- Eureka.AI - Supabase Database Schema
-- ============================================

-- Enable vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table (synchronize with auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    profile_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX users_email_idx ON public.users(email);

-- Notes table
CREATE TABLE public.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    subject TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for queries
CREATE INDEX notes_user_id_idx ON public.notes(user_id);
CREATE INDEX notes_subject_idx ON public.notes(subject);

-- Chunks table (for RAG)
CREATE TABLE public.chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    chapter_id INT NOT NULL DEFAULT 0,
    text TEXT NOT NULL,
    embedding VECTOR(1536), -- OpenAI text-embedding-3-small dimension
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create GIN index for vector similarity search
CREATE INDEX chunks_note_id_idx ON public.chunks(note_id);
CREATE INDEX chunks_embedding_idx ON public.chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Enable vector similarity operations
DO $$ BEGIN 
    CREATE FUNCTION public.match_chunks(
        query_embedding VECTOR(1536),
        filter_note_id UUID DEFAULT NULL,
        filter_similarity FLOAT8 DEFAULT 0.78,
        filter_top_k INT DEFAULT 4
    ) RETURNS TABLE (
        id UUID,
        note_id UUID,
        chapter_id INT,
        text TEXT,
        embedding VECTOR,
        similarity FLOAT8
    ) AS $$
    SELECT
        id,
        note_id,
        chapter_id,
        text,
        embedding,
        1 - (chunks.embedding <=> query_embedding) as similarity
    FROM chunks
    WHERE 1=1
      AND (filter_note_id IS NULL OR note_id = filter_note_id)
      AND 1 - (chunks.embedding <=> query_embedding) > filter_similarity
    ORDER BY chunks.embedding <=> query_embedding
    LIMIT filter_top_k;
    END $$ IMMUTABLE;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Presence table (collaboration tracking)
CREATE TABLE public.presence (
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
    last_active BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (note_id, user_id)
);

-- Chat messages table
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

-- Create index for parent_id queries
CREATE INDEX chat_messages_parent_idx ON public.chat_messages(parent_id);

-- Versions table (note versioning)
CREATE TABLE public.versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    version INT NOT NULL GENERATED ALWAYS AS (
        COALESCE((
            SELECT MAX(v.version) + 1
            FROM public.versions v
            WHERE v.note_id = notes.id
        ), 1) STORED
    ),
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(note_id, version)
);

-- Alternative versions table without generated column
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

-- Documents table (track uploaded/processed documents)
CREATE TABLE public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    source_type TEXT NOT NULL CHECK (source_type IN ('pdf', 'web', 'drive')),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for status queries
CREATE INDEX documents_status_idx ON public.documents(status);

-- Jobs table (background processing jobs)
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

-- Create index for note_id and status queries
CREATE INDEX jobs_note_id_idx ON public.jobs(note_id);
CREATE INDEX jobs_status_idx ON public.jobs(status);

-- Subjects table
CREATE TABLE public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default subjects if empty
INSERT INTO public.subjects (name, icon, color) VALUES
    ('Matematika', '📐', '#FF6B35'),
    ('Fisika', '⚡', '#4ECDC4'),
    ('Kimia', '🧪', '#95E1D3'),
    ('Biologi', '🧬', '#F7DC6F'),
    ('Sejarah', '📜', '#BB8FCE'),
    ('Bahasa Indonesia', '📚', '#F07167'),
    ('Bahasa Inggris', '🌍', '#81ECEC'),
    ('Ekonomi', '💰', '#FAB1A0')
ON CONFLICT DO NOTHING;

-- Real-time subscriptions enable
ALTER PUBLICATION supabase_public ADD TABLE ALL IN SCHEMA public;

-- Row Level Security (RLS)
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only access their own data
CREATE POLICY "Users can read own notes" ON public.notes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes" ON public.notes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes" ON public.notes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes" ON public.notes
    FOR DELETE USING (auth.uid() = user_id);

-- Same policies for chunks
CREATE POLICY "Users can read own chunks" ON public.chunks
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_id AND n.user_id = auth.uid())
    );

CREATE POLICY "Users can insert own chunks" ON public.chunks
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_id AND n.user_id = auth.uid())
    );

-- Same policies for chat_messages
CREATE POLICY "Users can read own chats" ON public.chat_messages
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_id AND n.user_id = auth.uid())
    );

CREATE POLICY "Users can insert own chats" ON public.chat_messages
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_id AND n.user_id = auth.uid())
    );

-- Same policies for documents and jobs
CREATE POLICY "Users can read own documents" ON public.documents
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_id AND n.user_id = auth.uid())
    );

CREATE POLICY "Users can read own jobs" ON public.jobs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.notes n WHERE n.id = note_id AND n.user_id = auth.uid())
    );

-- Public access to subjects
CREATE POLICY "Public can read subjects" ON public.subjects
    FOR SELECT USING (true);

-- Created_at and updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notes_timestamp
    BEFORE UPDATE ON public.notes
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_documents_timestamp
    BEFORE UPDATE ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_jobs_timestamp
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

-- User sync trigger
CREATE OR REPLACE FUNCTION public.sync_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name')
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        name = EXCLUDED.name,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_user();
