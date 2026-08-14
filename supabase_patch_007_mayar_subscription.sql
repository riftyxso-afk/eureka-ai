-- ============================================================
-- Eureka.AI - Patch 007: Langganan Mayar.id (premium subscription)
-- Menambahkan status premium ke public.users + tabel audit webhook
-- Mayar (untuk idempotensi & debugging).
-- Jalankan sekali di Supabase Dashboard > SQL Editor
-- ============================================================

-- ─── Kolom premium di public.users ─────────────────────────
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS premium_tier TEXT,          -- 'promo' | 'normal'
    ADD COLUMN IF NOT EXISTS mayar_license_code TEXT,
    ADD COLUMN IF NOT EXISTS mayar_product_id TEXT,
    ADD COLUMN IF NOT EXISTS mayar_customer_id TEXT;

CREATE INDEX IF NOT EXISTS users_premium_idx
    ON public.users (is_premium) WHERE is_premium = TRUE;

-- ─── Tabel audit webhook Mayar (idempotensi) ───────────────
CREATE TABLE IF NOT EXISTS public.mayar_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    transaction_id TEXT UNIQUE,          -- NULL utk event tanpa transaksi
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    matched_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mayar_webhook_events_created_idx
    ON public.mayar_webhook_events (created_at DESC);

-- ─── Tabel pemakaian fitur (kuota free tier) ─────────────────
-- Dipakai untuk fitur tanpa tabel natural (quiz, flashcards, bab-regenerate).
-- Chat asisten & generate catatan dihitung dari tabel yang sudah ada
-- (ai_chat_messages / notes).
CREATE TABLE IF NOT EXISTS public.feature_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    feature TEXT NOT NULL,               -- 'assistant-quiz' | 'assistant-flashcards' | 'bab-regenerate'
    used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feature_usage_user_feature_idx
    ON public.feature_usage (user_id, feature, used_at);

ALTER TABLE public.feature_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_usage service role" ON public.feature_usage
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ─── RLS: hanya service_role yang boleh akses ──────────────
ALTER TABLE public.mayar_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mayar_webhook_events service role" ON public.mayar_webhook_events
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
