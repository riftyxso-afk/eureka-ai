-- Patch 013: Jenis rangkuman (rangkuman | makalah | laporan | poin)
-- Jalankan di Supabase SQL Editor.

ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS note_type TEXT NOT NULL DEFAULT 'rangkuman';

CREATE INDEX IF NOT EXISTS idx_notes_note_type ON public.notes (note_type);
