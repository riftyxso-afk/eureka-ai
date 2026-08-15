-- ============================================================
-- Eureka.AI - Patch 012: Kode diskon GRATIS100 (100% gratis)
-- 1) Izinkan tipe 'free' di tabel discount_codes (aktivasi langsung
--    tanpa pembayaran — Pakasir tidak menerima amount 0).
-- 2) Buat kode GRATIS100: Rp 59.000 → Rp 0, premium 30 hari,
--    HANYA untuk 10 orang tercepat (max_uses = 10).
-- Jalankan sekali di Supabase Dashboard > SQL Editor
-- ============================================================

-- ─── 1) Perluas CHECK constraint type ───────────────────────
ALTER TABLE public.discount_codes
    DROP CONSTRAINT IF EXISTS discount_codes_type_check;

ALTER TABLE public.discount_codes
    ADD CONSTRAINT discount_codes_type_check
    CHECK (type IN ('percent', 'nominal', 'free'));

-- ─── 2) Kode gratis 100% — kuota 10 orang tercepat ──────────
INSERT INTO public.discount_codes (code, type, value, max_uses, active, description)
VALUES ('GRATIS100', 'free', 100, 10, TRUE, 'Pro gratis 100% — 10 orang tercepat (Rp 59.000 → Rp 0, 30 hari)')
ON CONFLICT (code) DO NOTHING;
