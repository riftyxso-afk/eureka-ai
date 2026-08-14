-- ============================================================
-- Eureka.AI - Patch 008: Trial gratis + kode diskon
-- Menambahkan klaim trial (7 hari, sekali seumur hidup) ke
-- public.users + tabel kode diskon (persen & nominal).
-- Jalankan SETELAH patch 007 di Supabase Dashboard > SQL Editor
-- ============================================================

-- ─── Kolom klaim trial di public.users ─────────────────────
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS trial_claimed_at TIMESTAMPTZ;

-- ─── Tabel kode diskon ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.discount_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,             -- kode yang diketik user (uppercase)
    type TEXT NOT NULL CHECK (type IN ('percent', 'nominal')),
    value NUMERIC NOT NULL CHECK (value > 0),
    -- percent: 1-100 (persen potongan); nominal: potongan Rupiah tetap.
    max_uses INT CHECK (max_uses IS NULL OR max_uses > 0),
    used_count INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS discount_codes_code_idx
    ON public.discount_codes (code);

-- ─── RLS: hanya service_role yang boleh akses ──────────────
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "discount_codes service role" ON public.discount_codes
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ─── Increment pemakaian kode secara atomik (dipanggil server) ──
CREATE OR REPLACE FUNCTION public.increment_discount_use(p_code TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.discount_codes
    SET used_count = used_count + 1
    WHERE code = p_code
      AND active = TRUE
      AND (max_uses IS NULL OR used_count < max_uses)
      AND (expires_at IS NULL OR expires_at > NOW());
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
