-- ============================================================
-- Eureka.AI - Patch 004: Share Chat Asisten AI
-- Snapshot percakapan yang dibagikan publik via link (view-only).
-- Snapshot beku: pesan baru setelah share tidak mengubah isinya,
-- dan menghapus sesi asli tidak menghapus share.
-- Jalankan sekali di Supabase Dashboard > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_chat_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Referensi longgar ke sesi asal (TANPA FK: sesi boleh dihapus,
    -- share harus tetap hidup).
    session_id UUID,
    -- Denormalisasi pemilik (housekeeping + lapisan RLS).
    user_id UUID,
    title TEXT NOT NULL DEFAULT 'Percakapan',
    -- Token publik 32-hex (128 bit entropy) dari randomBytes(16).
    token TEXT NOT NULL UNIQUE,
    -- [{ role, content }, ...] diurutkan kronologis saat di-share.
    snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_chat_shares_token_idx
    ON public.ai_chat_shares (token);
CREATE INDEX IF NOT EXISTS ai_chat_shares_user_idx
    ON public.ai_chat_shares (user_id, created_at DESC);

ALTER TABLE public.ai_chat_shares ENABLE ROW LEVEL SECURITY;

-- Praktiknya akses lewat service-role di server (lib/supabase/admin);
-- policy ini lapisan belakang: hanya pemilik yang boleh memanipulasi
-- baris share miliknya bila diakses langsung.
CREATE POLICY "ai_chat_shares owner select" ON public.ai_chat_shares
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ai_chat_shares owner insert" ON public.ai_chat_shares
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "ai_chat_shares owner delete" ON public.ai_chat_shares
    FOR DELETE USING (user_id = auth.uid());
