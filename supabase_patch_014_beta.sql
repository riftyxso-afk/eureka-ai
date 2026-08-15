-- Patch 014: Beta tester — akses fitur baru (mic composer & AI call).
-- Jalankan di Supabase SQL Editor.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_beta BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS beta_joined_at TIMESTAMPTZ;
