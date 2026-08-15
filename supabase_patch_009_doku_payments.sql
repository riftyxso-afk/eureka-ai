-- ============================================================
-- Eureka.AI - Patch 009: Ganti payment gateway Mayar.id → DOKU
-- Menambahkan kolom/tabel DOKU, menghapus seluruh jejak Mayar
-- (kolom mayar_* di public.users + tabel mayar_webhook_events).
--
-- ⚠️ BACKUP DULU sebelum dijalankan (kolom mayar_* akan di-drop):
--   Supabase Dashboard → Database → Backups → Ambil backup terbaru
--   ATAU jalankan:  CREATE TABLE backup_users_mayar AS
--                   SELECT id, mayar_license_code, mayar_product_id,
--                          mayar_customer_id FROM public.users;
--
-- Jalankan sekali di Supabase Dashboard > SQL Editor
-- ============================================================

-- ─── Kolom DOKU di public.users ───────────────────────────
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS doku_invoice_number TEXT,   -- invoice terakhir yang dibayar
    ADD COLUMN IF NOT EXISTS doku_transaction_id TEXT;   -- transaction id dari notifikasi DOKU

CREATE INDEX IF NOT EXISTS users_doku_invoice_idx
    ON public.users (doku_invoice_number)
    WHERE doku_invoice_number IS NOT NULL;

-- ─── Tabel permintaan pembayaran DOKU ─────────────────────
-- invoice → user + tier + amount, dicatat saat checkout dibuat agar webhook
-- bisa mencocokkan & menentukan tier (termasuk saat harga dipotong diskon).
CREATE TABLE IF NOT EXISTS public.doku_payment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    invoice_number TEXT UNIQUE NOT NULL,   -- EKA{timestamp}{random}
    amount BIGINT NOT NULL,                -- harga final yang dikirim ke DOKU
    tier TEXT NOT NULL,                    -- 'promo' | 'normal'
    status TEXT NOT NULL DEFAULT 'pending',-- 'pending' | 'paid'
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS doku_payment_requests_user_idx
    ON public.doku_payment_requests (user_id, created_at DESC);

-- ─── Tabel audit notifikasi DOKU (idempotensi) ────────────
CREATE TABLE IF NOT EXISTS public.doku_notification_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT UNIQUE,            -- kunci idempotensi (NULL utk event tanpa invoice)
    status TEXT,
    amount BIGINT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    matched_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS doku_notification_events_created_idx
    ON public.doku_notification_events (created_at DESC);

-- ─── Hapus seluruh jejak Mayar ────────────────────────────
DROP TABLE IF EXISTS public.mayar_webhook_events;

ALTER TABLE public.users
    DROP COLUMN IF EXISTS mayar_license_code,
    DROP COLUMN IF EXISTS mayar_product_id,
    DROP COLUMN IF EXISTS mayar_customer_id;

-- ─── RLS: hanya service_role yang boleh akses ─────────────
ALTER TABLE public.doku_payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doku_payment_requests service role" ON public.doku_payment_requests
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.doku_notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doku_notification_events service role" ON public.doku_notification_events
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
