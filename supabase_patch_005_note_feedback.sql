-- ============================================================
-- Eureka.AI - Patch 005: Survey Performa Eureka (note_feedback)
-- Survey sekali per user: muncul ~1 menit setelah catatan pertama
-- selesai dibuat. Satu baris per user (UNIQUE user_id) = jaminan
-- anti-duplikat: submit kedua ditolak, dismiss permanen.
-- Jalankan sekali di Supabase Dashboard > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.note_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Pemilik survey — satu baris per user.
    user_id UUID NOT NULL UNIQUE,
    -- Rating performa Eureka 1-5; NULL bila user dismiss tanpa submit.
    rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
    -- Saran perbaikan (opsional).
    suggestion TEXT,
    -- true bila user menutup survey tanpa submit (tetap dihitung selesai).
    dismissed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index untuk pencarian per user (praktisnya query via user_id).
CREATE INDEX IF NOT EXISTS note_feedback_user_idx
    ON public.note_feedback (user_id);

ALTER TABLE public.note_feedback ENABLE ROW LEVEL SECURITY;

-- Praktiknya akses lewat service-role di server (lib/supabase/admin);
-- policy ini lapisan belakang: hanya pemilik yang boleh membaca/menulis
-- baris survey miliknya bila diakses langsung.
CREATE POLICY "note_feedback owner select" ON public.note_feedback
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "note_feedback owner insert" ON public.note_feedback
    FOR INSERT WITH CHECK (user_id = auth.uid());