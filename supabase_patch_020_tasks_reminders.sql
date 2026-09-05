-- ============================================================
-- Patch 020 — Fitur Tugas & pengingat (task-reminders)
--
-- 1) Tabel tasks: tugas/tugas-rumah dengan tenggat + pengingat.
-- 2) Perluas CHECK type notifikasi agar bisa mengirim pengingat
--    (exam_reminder & task_reminder) lewat lonceng + web push.
-- ============================================================

-- 1) Tabel tasks ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    subject TEXT NOT NULL DEFAULT 'Umum',
    -- Tenggat wajib; pengingat dikirim mendekati tenggat.
    due_date DATE NOT NULL,
    -- Jam tenggat (0-23, zona WIB default server). NULL = 23:59.
    due_hour SMALLINT CHECK (due_hour BETWEEN 0 AND 23),
    prioritas TEXT NOT NULL DEFAULT 'sedang' CHECK (prioritas IN ('rendah','sedang','tinggi')),
    status TEXT NOT NULL DEFAULT 'belum' CHECK (status IN ('belum','progres','selesai')),
    -- Pengingat: berapa jam sebelum tenggat (24 = H-1, 1 = H-1 jam, dst).
    remind_hours_before SMALLINT NOT NULL DEFAULT 24 CHECK (remind_hours_before IN (1, 6, 24, 72)),
    -- Mencegah pengingat dobel: waktu pengingat yang sudah dikirim.
    reminder_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tasks_user_due_idx ON public.tasks(user_id, due_date);
CREATE INDEX IF NOT EXISTS tasks_due_pending_idx ON public.tasks(due_date, status)
    WHERE status <> 'selesai';

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks select own" ON public.tasks
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tasks insert own" ON public.tasks
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks update own" ON public.tasks
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tasks delete own" ON public.tasks
    FOR DELETE USING (auth.uid() = user_id);

-- 2) Perluas tipe notifikasi --------------------------------------------------
-- (tambahkan 'exam_reminder' dan 'task_reminder' ke CHECK constraint)
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_check CHECK (
        type IN ('friend_request', 'friend_accepted', 'mention', 'achievement', 'note_ready', 'exam_reminder', 'task_reminder')
    );
