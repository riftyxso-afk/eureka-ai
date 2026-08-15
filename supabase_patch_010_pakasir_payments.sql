-- ============================================================
-- Eureka.AI - Patch 010: Ganti payment gateway DOKU → Pakasir
-- Menghapus seluruh jejak DOKU (tabel doku_* + kolom users.doku_*)
-- dan menambahkan tabel/kolom Pakasir.
--
-- ⚠️ BACKUP DULU sebelum dijalankan (tabel doku_* & kolom users.doku_*
--    akan di-DROP bersama datanya):
--   Supabase Dashboard → Database → Backups → Ambil backup terbaru
--
-- Jalankan sekali di Supabase Dashboard > SQL Editor
-- ============================================================

-- ─── Kolom Pakasir di public.users ──────────────────────────
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS pakasir_invoice_number TEXT,  -- order_id terakhir yang dibayar
    ADD COLUMN IF NOT EXISTS pakasir_transaction_id TEXT;  -- referensi transaksi Pakasir

CREATE INDEX IF NOT EXISTS users_pakasir_invoice_idx
    ON public.users (pakasir_invoice_number)
    WHERE pakasir_invoice_number IS NOT NULL;

-- ─── Tabel permintaan pembayaran Pakasir ────────────────────
-- order_id → user + tier + amount, dicatat saat checkout dibuat agar webhook
-- bisa mencocokkan & menentukan tier (termasuk saat harga dipotong diskon).
CREATE TABLE IF NOT EXISTS public.pakasir_payment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    order_id TEXT UNIQUE NOT NULL,         -- EKA{timestamp}{random}
    amount BIGINT NOT NULL,                -- harga final yang dikirim ke Pakasir
    tier TEXT NOT NULL,                    -- 'promo' | 'normal'
    status TEXT NOT NULL DEFAULT 'pending',-- 'pending' | 'paid'
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pakasir_payment_requests_user_idx
    ON public.pakasir_payment_requests (user_id, created_at DESC);

-- ─── Tabel audit webhook Pakasir (idempotensi) ──────────────
CREATE TABLE IF NOT EXISTS public.pakasir_notification_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT UNIQUE,                  -- kunci idempotensi (NULL utk event tanpa order)
    status TEXT,
    amount BIGINT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    matched_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pakasir_notification_events_created_idx
    ON public.pakasir_notification_events (created_at DESC);

-- ─── Hapus seluruh jejak DOKU ───────────────────────────────
DROP TABLE IF EXISTS public.doku_payment_requests;
DROP TABLE IF EXISTS public.doku_notification_events;

ALTER TABLE public.users
    DROP COLUMN IF EXISTS doku_invoice_number,
    DROP COLUMN IF EXISTS doku_transaction_id;

-- ─── RLS: hanya service_role yang boleh akses ───────────────
ALTER TABLE public.pakasir_payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pakasir_payment_requests service role" ON public.pakasir_payment_requests
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.pakasir_notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pakasir_notification_events service role" ON public.pakasir_notification_events
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
