-- ============================================================
-- Eureka.AI - Patch 019: Kolom source_url pada catatan
-- Menyimpan URL sumber asli catatan (mis. link YouTube) agar
-- halaman /dashboard/note/[id] bisa menampilkan player video
-- dan pdfImages dapat menelusuri halaman sumber.
-- Jalankan sekali di Supabase Dashboard > SQL Editor
-- ============================================================

ALTER TABLE public.notes
    ADD COLUMN IF NOT EXISTS source_url TEXT;

COMMENT ON COLUMN public.notes.source_url IS
    'URL sumber asli catatan (YouTube/web) — dipakai embed video & pencarian gambar PDF.';
