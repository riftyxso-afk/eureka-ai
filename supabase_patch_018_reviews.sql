-- ============================================================
-- Eureka.AI - Patch 018: Tabel Ulasan Produk (reviews)
--
-- Untuk JSON-LD aggregateRating & review (Cuplikan produk Google).
-- Satu user = satu ulasan (unique user_id) — upsert saat submit ulang.
--
-- RLS: SELECT terbuka (ulasan publik), tulis/hapus hanya pemilik.
-- Server memakai service-role (bypass RLS) untuk aggregasi.
--
-- SCRIPT INI IDEMPOTEN & ATOMIK (BEGIN/COMMIT) — aman dijalankan ulang.
-- Jalankan SEKALI utuh di Supabase Dashboard > SQL Editor.
-- ============================================================

BEGIN;

-- ─── Tabel reviews ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT 'Pengguna',
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title       TEXT,
  content     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reviews_user_unique UNIQUE (user_id)
);

-- ─── RLS ───────────────────────────────────────────────────
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews select public" ON public.reviews;
CREATE POLICY "reviews select public" ON public.reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "reviews insert own" ON public.reviews;
CREATE POLICY "reviews insert own" ON public.reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews update own" ON public.reviews;
CREATE POLICY "reviews update own" ON public.reviews
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews delete own" ON public.reviews;
CREATE POLICY "reviews delete own" ON public.reviews
  FOR DELETE USING (auth.uid() = user_id);

COMMIT;
