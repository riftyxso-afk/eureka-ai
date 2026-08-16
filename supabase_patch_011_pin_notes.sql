-- ============================================================
-- Eureka.AI - Patch 011: Fitur semat (pin) catatan di dashboard
-- Menambahkan kolom `pinned` pada tabel notes + indeks parsial
-- agar query "catatan tersemat dulu" efisien.
--
-- Idempoten: aman dijalankan berulang (ADD COLUMN IF NOT EXISTS).
-- Jalankan sekali di Supabase Dashboard > SQL Editor.
-- ============================================================

ALTER TABLE public.notes
    ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS notes_user_pinned_idx
    ON public.notes (user_id)
    WHERE pinned = TRUE;

-- RLS: kebijakan "notes update own" yang sudah ada mencakup kolom baru,
-- jadi tidak perlu policy tambahan.
