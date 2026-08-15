-- ============================================================
-- Patch 011 — Fitur Referral
-- Aditif & AMAN: hanya menambah kolom + index, tidak ada DROP.
-- Jalankan di Supabase > SQL Editor. Backup dianjurkan sebelum eksekusi.
-- ============================================================

-- Kolom referral di tabel users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS referral_rewarded BOOLEAN NOT NULL DEFAULT FALSE;

-- Kode referral unik (case-insensitive) — lookup pakai ILIKE / lower()
CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_lower_uniq
  ON public.users (lower(referral_code));

-- Percepat hitungan rujukan: users WHERE referred_by = <user>
CREATE INDEX IF NOT EXISTS users_referred_by_idx
  ON public.users (referred_by);

-- Sanity: pastikan kolom ada
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name IN ('referral_code', 'referred_by', 'referral_rewarded')
ORDER BY column_name;
