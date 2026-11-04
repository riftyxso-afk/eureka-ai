-- ============================================================
-- Eureka.AI - Patch 022: Courses
-- Normalized course content, enrollment, attempts, rewards, AI quota,
-- and generation jobs. Server writes use service-role; grading and quota
-- consumption are restricted to the SECURITY DEFINER functions below.
-- Idempotent and atomic: run the whole script in Supabase SQL Editor.
-- ============================================================

BEGIN;

-- 1) Course content -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courses (
    id TEXT PRIMARY KEY,
    creator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    visibility TEXT NOT NULL DEFAULT 'private'
        CHECK (visibility IN ('private', 'published')),
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published')),
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('Pemula', 'Menengah')),
    description TEXT NOT NULL DEFAULT '',
    outcome TEXT NOT NULL DEFAULT '',
    audience TEXT NOT NULL DEFAULT '',
    prerequisites JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(prerequisites) = 'array'),
    estimated_minutes INTEGER NOT NULL DEFAULT 0 CHECK (estimated_minutes >= 0),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    source_kind TEXT NOT NULL DEFAULT 'curated'
        CHECK (source_kind IN ('curated', 'generated')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS courses_creator_idx ON public.courses(creator_id);
CREATE INDEX IF NOT EXISTS courses_public_idx
    ON public.courses(visibility, status) WHERE visibility = 'published';

CREATE TABLE IF NOT EXISTS public.course_modules (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position >= 0),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    UNIQUE (course_id, position)
);

CREATE TABLE IF NOT EXISTS public.course_lessons (
    id TEXT PRIMARY KEY,
    module_id TEXT NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position >= 0),
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    minutes INTEGER NOT NULL DEFAULT 0 CHECK (minutes >= 0),
    objectives JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(objectives) = 'array'),
    content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'ready', 'error')),
    content_version INTEGER NOT NULL DEFAULT 1 CHECK (content_version >= 1),
    generation_error TEXT,
    UNIQUE (module_id, position)
);

CREATE INDEX IF NOT EXISTS course_lessons_status_idx
    ON public.course_lessons(module_id, status);

CREATE TABLE IF NOT EXISTS public.course_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    lesson_id TEXT REFERENCES public.course_lessons(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    note TEXT
);

CREATE INDEX IF NOT EXISTS course_sources_course_idx
    ON public.course_sources(course_id);
CREATE INDEX IF NOT EXISTS course_sources_lesson_idx
    ON public.course_sources(lesson_id) WHERE lesson_id IS NOT NULL;

-- Answers and explanations are readable only through the grading RPC after
-- submission, or directly by service-role for authoring sanitized DTOs.
CREATE TABLE IF NOT EXISTS public.lesson_questions (
    id TEXT PRIMARY KEY,
    lesson_id TEXT NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
    version INTEGER NOT NULL CHECK (version >= 1),
    position INTEGER NOT NULL CHECK (position >= 0),
    prompt TEXT NOT NULL,
    options JSONB NOT NULL CHECK (jsonb_typeof(options) = 'array'),
    answer INTEGER NOT NULL,
    explanation TEXT NOT NULL DEFAULT '',
    UNIQUE (lesson_id, version, position),
    CHECK (answer >= 0 AND answer < jsonb_array_length(options))
);

-- 2) Enrollment and learning records ----------------------------------------
CREATE TABLE IF NOT EXISTS public.course_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    course_version INTEGER NOT NULL DEFAULT 1 CHECK (course_version >= 1),
    current_lesson_id TEXT REFERENCES public.course_lessons(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS course_enrollments_course_idx
    ON public.course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS course_enrollments_current_lesson_idx
    ON public.course_enrollments(current_lesson_id)
    WHERE current_lesson_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.lesson_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
    lesson_id TEXT NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'completed')),
    best_score INTEGER NOT NULL DEFAULT 0 CHECK (best_score BETWEEN 0 AND 100),
    completed_at TIMESTAMPTZ,
    UNIQUE (enrollment_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS lesson_progress_lesson_idx
    ON public.lesson_progress(lesson_id);

CREATE TABLE IF NOT EXISTS public.course_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    lesson_id TEXT NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
    question_version INTEGER NOT NULL CHECK (question_version >= 1),
    answers JSONB NOT NULL CHECK (jsonb_typeof(answers) = 'object'),
    score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
    passed BOOLEAN NOT NULL,
    xp_awarded INTEGER NOT NULL DEFAULT 0 CHECK (xp_awarded >= 0),
    result_json JSONB NOT NULL CHECK (jsonb_typeof(result_json) = 'object'),
    idempotency_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, lesson_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS course_attempts_lesson_idx
    ON public.course_attempts(lesson_id, created_at DESC);
CREATE INDEX IF NOT EXISTS course_attempts_user_idx
    ON public.course_attempts(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.course_reward_events (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    event_key TEXT PRIMARY KEY,
    xp INTEGER NOT NULL CHECK (xp > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS course_reward_events_user_idx
    ON public.course_reward_events(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.course_ai_usage (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    feature TEXT NOT NULL CHECK (btrim(feature) <> ''),
    used_on DATE NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
    PRIMARY KEY (user_id, feature, used_on)
);

CREATE TABLE IF NOT EXISTS public.course_generation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    lesson_id TEXT REFERENCES public.course_lessons(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('syllabus', 'lesson')),
    status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'done', 'error')),
    input_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT course_generation_jobs_dedupe
        UNIQUE NULLS NOT DISTINCT (user_id, course_id, lesson_id, kind, input_hash)
);

CREATE INDEX IF NOT EXISTS course_generation_jobs_course_idx
    ON public.course_generation_jobs(course_id, status);
CREATE INDEX IF NOT EXISTS course_generation_jobs_lesson_idx
    ON public.course_generation_jobs(lesson_id) WHERE lesson_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS course_generation_jobs_status_idx
    ON public.course_generation_jobs(status, updated_at);

-- Reuse the existing timestamp trigger function from the base schema.
DROP TRIGGER IF EXISTS courses_set_updated_at ON public.courses;
CREATE TRIGGER courses_set_updated_at
    BEFORE UPDATE ON public.courses
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS course_enrollments_set_updated_at ON public.course_enrollments;
CREATE TRIGGER course_enrollments_set_updated_at
    BEFORE UPDATE ON public.course_enrollments
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS course_generation_jobs_set_updated_at ON public.course_generation_jobs;
CREATE TRIGGER course_generation_jobs_set_updated_at
    BEFORE UPDATE ON public.course_generation_jobs
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3) Row-level security ------------------------------------------------------
-- There are intentionally no INSERT/UPDATE/DELETE policies for anon or
-- authenticated users. Service-role performs content, enrollment, generation,
-- progress, and reward writes. lesson_questions has no client SELECT policy so
-- its answers/explanations cannot be fetched before grading.
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_reward_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_generation_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "courses readable" ON public.courses;
CREATE POLICY "courses readable" ON public.courses
    FOR SELECT USING (
        creator_id = auth.uid()
        OR (visibility = 'published' AND status = 'published')
    );

DROP POLICY IF EXISTS "course_modules readable" ON public.course_modules;
CREATE POLICY "course_modules readable" ON public.course_modules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.courses c
            WHERE c.id = course_id
              AND (
                  c.creator_id = auth.uid()
                  OR (c.visibility = 'published' AND c.status = 'published')
              )
        )
    );

DROP POLICY IF EXISTS "course_lessons readable" ON public.course_lessons;
CREATE POLICY "course_lessons readable" ON public.course_lessons
    FOR SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.course_modules m
            JOIN public.courses c ON c.id = m.course_id
            WHERE m.id = module_id
              AND (
                  c.creator_id = auth.uid()
                  OR (c.visibility = 'published' AND c.status = 'published')
              )
        )
    );

DROP POLICY IF EXISTS "course_sources readable" ON public.course_sources;
CREATE POLICY "course_sources readable" ON public.course_sources
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.courses c
            WHERE c.id = course_id
              AND (
                  c.creator_id = auth.uid()
                  OR (c.visibility = 'published' AND c.status = 'published')
              )
        )
    );

DROP POLICY IF EXISTS "course_enrollments select own" ON public.course_enrollments;
CREATE POLICY "course_enrollments select own" ON public.course_enrollments
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "lesson_progress select own" ON public.lesson_progress;
CREATE POLICY "lesson_progress select own" ON public.lesson_progress
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.course_enrollments e
            WHERE e.id = enrollment_id AND e.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "course_attempts select own" ON public.course_attempts;
CREATE POLICY "course_attempts select own" ON public.course_attempts
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "course_reward_events select own" ON public.course_reward_events;
CREATE POLICY "course_reward_events select own" ON public.course_reward_events
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "course_ai_usage select own" ON public.course_ai_usage;
CREATE POLICY "course_ai_usage select own" ON public.course_ai_usage
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "course_generation_jobs select own" ON public.course_generation_jobs;
CREATE POLICY "course_generation_jobs select own" ON public.course_generation_jobs
    FOR SELECT USING (auth.uid() = user_id);

-- 4) Atomic, server-only AI quota consumption --------------------------------
CREATE OR REPLACE FUNCTION public.consume_course_ai_quota(
    p_user_id UUID,
    p_feature TEXT,
    p_limit INTEGER,
    p_used_on DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Cannot consume another user''s course AI quota';
    END IF;

    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'A user is required';
    END IF;

    IF p_feature IS NULL OR btrim(p_feature) = '' THEN
        RAISE EXCEPTION 'A course AI feature is required';
    END IF;

    IF p_limit IS NULL OR p_limit < 1 THEN
        RETURN FALSE;
    END IF;

    -- The conflict update takes the row lock and rechecks this predicate, so
    -- concurrent callers cannot increment the same daily counter past p_limit.
    INSERT INTO public.course_ai_usage AS usage
        (user_id, feature, used_on, request_count)
    VALUES
        (p_user_id, p_feature, COALESCE(p_used_on, CURRENT_DATE), 1)
    ON CONFLICT (user_id, feature, used_on) DO UPDATE
        SET request_count = usage.request_count + 1
        WHERE usage.request_count < p_limit;

    RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_course_ai_quota(UUID, TEXT, INTEGER, DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_course_ai_quota(UUID, TEXT, INTEGER, DATE) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_course_ai_quota(UUID, TEXT, INTEGER, DATE) FROM anon;
GRANT EXECUTE ON FUNCTION public.consume_course_ai_quota(UUID, TEXT, INTEGER, DATE) TO service_role;

-- 5) Atomic, server-only lesson grading --------------------------------------
CREATE OR REPLACE FUNCTION public.submit_course_attempt(
    p_user_id UUID,
    p_course_id TEXT,
    p_lesson_id TEXT,
    p_answers JSONB,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_enrollment_id UUID;
    v_course_title TEXT;
    v_lesson_title TEXT;
    v_existing_result JSONB;
    v_question RECORD;
    v_question_version INTEGER;
    v_raw_answer TEXT;
    v_selected_answer INTEGER;
    v_is_correct BOOLEAN;
    v_correct_count INTEGER := 0;
    v_total_questions INTEGER := 0;
    v_results JSONB := '[]'::jsonb;
    v_score INTEGER;
    v_passed BOOLEAN;
    v_xp_awarded INTEGER := 0;
    v_today TEXT := TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD');
    v_completed_count INTEGER;
    v_total_lessons INTEGER;
    v_next_lesson_id TEXT;
    v_current_lesson_id TEXT;
    v_result JSONB;
BEGIN
    -- service-role calls normally have auth.uid() = NULL. If a user JWT is
    -- present, it must match the user whose records are being changed.
    IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Cannot submit another user''s course attempt';
    END IF;

    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'A user is required';
    END IF;

    IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'An idempotency key is required';
    END IF;

    IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN
        RAISE EXCEPTION 'Answers must be a JSON object keyed by question id';
    END IF;

    -- Serialize attempts for this enrollment. Besides protecting progress,
    -- this makes concurrent retries of the same idempotency key deterministic.
    SELECT e.id INTO v_enrollment_id
    FROM public.course_enrollments e
    WHERE e.user_id = p_user_id AND e.course_id = p_course_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Course enrollment not found';
    END IF;

    SELECT c.title INTO v_course_title
    FROM public.courses c
    WHERE c.id = p_course_id
      AND (
          c.creator_id = p_user_id
          OR (c.visibility = 'published' AND c.status = 'published')
      );

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Course not found or access denied';
    END IF;

    SELECT l.title, l.content_version INTO v_lesson_title, v_question_version
    FROM public.course_lessons l
    JOIN public.course_modules m ON m.id = l.module_id
    WHERE l.id = p_lesson_id
      AND m.course_id = p_course_id
      AND l.status = 'ready';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lesson not found or not ready in this course';
    END IF;

    -- A retry returns the original post-grading response without changing any
    -- score, progress, reward, XP, activity, or current-lesson state.
    SELECT a.result_json INTO v_existing_result
    FROM public.course_attempts a
    WHERE a.user_id = p_user_id
      AND a.lesson_id = p_lesson_id
      AND a.idempotency_key = p_idempotency_key;

    IF FOUND THEN
        RETURN v_existing_result;
    END IF;

    -- Grade only the lesson's actual content version. Attempts and rewards use
    -- that same version, never a newer/older stray question row with MAX(version).
    -- No question row is exposed by client RLS before grading.
    FOR v_question IN
        SELECT q.id, q.answer, q.explanation
        FROM public.lesson_questions q
        WHERE q.lesson_id = p_lesson_id AND q.version = v_question_version
        ORDER BY q.position, q.id
    LOOP
        v_total_questions := v_total_questions + 1;
        v_selected_answer := NULL;
        v_raw_answer := p_answers ->> v_question.id;

        -- Invalid, missing, negative, fractional, and oversized values are
        -- treated as unanswered instead of being cast or trusted as answers.
        IF v_raw_answer ~ '^[0-9]{1,9}$' THEN
            v_selected_answer := v_raw_answer::INTEGER;
        END IF;

        v_is_correct := v_selected_answer IS NOT NULL
            AND v_selected_answer = v_question.answer;

        IF v_is_correct THEN
            v_correct_count := v_correct_count + 1;
        END IF;

        v_results := v_results || jsonb_build_array(
            jsonb_build_object(
                'questionId', v_question.id,
                'selectedAnswer', v_selected_answer,
                'correctAnswer', v_question.answer,
                'isCorrect', v_is_correct,
                'explanation', v_question.explanation
            )
        );
    END LOOP;

    IF v_total_questions <> 2 THEN
        RAISE EXCEPTION 'Lesson must contain exactly 2 questions in the current version';
    END IF;

    v_score := ROUND((v_correct_count::NUMERIC * 100) / v_total_questions)::INTEGER;
    v_passed := v_score >= 70;

    INSERT INTO public.lesson_progress
        (enrollment_id, lesson_id, status, best_score, completed_at)
    VALUES
        (
            v_enrollment_id,
            p_lesson_id,
            CASE WHEN v_passed THEN 'completed' ELSE 'in_progress' END,
            v_score,
            CASE WHEN v_passed THEN NOW() ELSE NULL END
        )
    ON CONFLICT (enrollment_id, lesson_id) DO UPDATE
        SET best_score = GREATEST(lesson_progress.best_score, EXCLUDED.best_score),
            status = CASE
                WHEN lesson_progress.status = 'completed' OR EXCLUDED.status = 'completed'
                THEN 'completed'
                ELSE 'in_progress'
            END,
            completed_at = COALESCE(lesson_progress.completed_at, EXCLUDED.completed_at);

    -- A successful first attempt for a question version earns 20 XP. The
    -- globally unique event key makes rewards safe across retries and workers.
    IF v_passed THEN
        INSERT INTO public.course_reward_events (user_id, event_key, xp)
        VALUES (
            p_user_id,
            'course_lesson:' || p_user_id::TEXT || ':' || p_lesson_id || ':' || v_question_version::TEXT,
            20
        )
        ON CONFLICT (event_key) DO NOTHING
        RETURNING xp INTO v_xp_awarded;

        v_xp_awarded := COALESCE(v_xp_awarded, 0);
    END IF;

    -- This upsert and the activity insert share the function's transaction
    -- with the attempt, progress, and reward writes; any failure rolls all back.
    INSERT INTO public.progress (user_id, xp, active_days, updated_at)
    VALUES (p_user_id, v_xp_awarded, ARRAY[v_today], NOW())
    ON CONFLICT (user_id) DO UPDATE
        SET xp = progress.xp + v_xp_awarded,
            active_days = CASE
                WHEN v_today = ANY(progress.active_days) THEN progress.active_days
                ELSE array_append(progress.active_days, v_today)
            END,
            updated_at = NOW();

    IF v_xp_awarded > 0 THEN
        INSERT INTO public.activity_log (user_id, xp, label)
        VALUES (
            p_user_id,
            v_xp_awarded,
            LEFT('Kursus: ' || v_course_title || ' - ' || v_lesson_title, 80)
        );
    END IF;

    SELECT COUNT(*)::INTEGER INTO v_total_lessons
    FROM public.course_lessons l
    JOIN public.course_modules m ON m.id = l.module_id
    WHERE m.course_id = p_course_id;

    SELECT COUNT(*)::INTEGER INTO v_completed_count
    FROM public.course_lessons l
    JOIN public.course_modules m ON m.id = l.module_id
    JOIN public.lesson_progress lp
      ON lp.lesson_id = l.id
     AND lp.enrollment_id = v_enrollment_id
     AND lp.status = 'completed'
    WHERE m.course_id = p_course_id;

    -- Prefer the first incomplete ready lesson, then any incomplete lesson.
    -- When everything is complete, retain the final lesson as the current one.
    SELECT l.id INTO v_next_lesson_id
    FROM public.course_lessons l
    JOIN public.course_modules m ON m.id = l.module_id
    WHERE m.course_id = p_course_id
      AND NOT EXISTS (
          SELECT 1 FROM public.lesson_progress lp
          WHERE lp.enrollment_id = v_enrollment_id
            AND lp.lesson_id = l.id
            AND lp.status = 'completed'
      )
    ORDER BY CASE WHEN l.status = 'ready' THEN 0 ELSE 1 END,
             m.position, l.position, l.id
    LIMIT 1;

    IF v_next_lesson_id IS NULL THEN
        SELECT l.id INTO v_next_lesson_id
        FROM public.course_lessons l
        JOIN public.course_modules m ON m.id = l.module_id
        WHERE m.course_id = p_course_id
        ORDER BY m.position DESC, l.position DESC, l.id DESC
        LIMIT 1;
    END IF;

    v_current_lesson_id := CASE WHEN v_passed THEN v_next_lesson_id ELSE p_lesson_id END;

    UPDATE public.course_enrollments
    SET current_lesson_id = v_current_lesson_id,
        updated_at = NOW()
    WHERE id = v_enrollment_id;

    v_result := jsonb_build_object(
        'score', v_score,
        'passed', v_passed,
        'correctAnswers', v_correct_count,
        'totalQuestions', v_total_questions,
        'xpAwarded', v_xp_awarded,
        'results', v_results,
        'progress', jsonb_build_object(
            'completedLessons', v_completed_count,
            'totalLessons', v_total_lessons,
            'percent', CASE
                WHEN v_total_lessons = 0 THEN 0
                ELSE ROUND((v_completed_count::NUMERIC * 100) / v_total_lessons)::INTEGER
            END,
            'currentLessonId', v_current_lesson_id
        ),
        'storage', 'supabase'
    );

    INSERT INTO public.course_attempts (
        user_id,
        lesson_id,
        question_version,
        answers,
        score,
        passed,
        xp_awarded,
        result_json,
        idempotency_key
    ) VALUES (
        p_user_id,
        p_lesson_id,
        v_question_version,
        p_answers,
        v_score,
        v_passed,
        v_xp_awarded,
        v_result,
        p_idempotency_key
    );

    RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_course_attempt(UUID, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_course_attempt(UUID, TEXT, TEXT, JSONB, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_course_attempt(UUID, TEXT, TEXT, JSONB, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_course_attempt(UUID, TEXT, TEXT, JSONB, TEXT) TO service_role;

-- 6) Transactional personal-course creation ----------------------------------
CREATE OR REPLACE FUNCTION public.save_personal_course(
    p_user_id UUID,
    p_course JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_course_id TEXT;
    v_existing_creator UUID;
    v_existing_source_kind TEXT;
    v_module JSONB;
    v_lesson JSONB;
    v_module_index INTEGER;
    v_lesson_index INTEGER;
    v_module_id TEXT;
    v_lesson_id TEXT;
    v_module_ids TEXT[] := ARRAY[]::TEXT[];
    v_lesson_ids TEXT[] := ARRAY[]::TEXT[];
    v_minutes INTEGER;
    v_estimated_minutes INTEGER := 0;
BEGIN
    IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Cannot save another user''s personal course';
    END IF;

    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'A user is required';
    END IF;

    IF p_course IS NULL OR jsonb_typeof(p_course) <> 'object' THEN
        RAISE EXCEPTION 'Personal course must be a JSON object';
    END IF;

    v_course_id := p_course->>'id';
    IF v_course_id IS NULL OR LEFT(v_course_id, 7) <> 'custom-'
       OR char_length(v_course_id) <= 7 THEN
        RAISE EXCEPTION 'Personal course id must start with custom-';
    END IF;

    IF p_course->>'sourceKind' IS DISTINCT FROM 'generated' THEN
        RAISE EXCEPTION 'Personal course must be generated';
    END IF;

    IF char_length(btrim(COALESCE(p_course->>'title', ''))) < 3
       OR char_length(btrim(COALESCE(p_course->>'outcome', ''))) < 10 THEN
        RAISE EXCEPTION 'Personal course title and outcome are incomplete';
    END IF;

    IF p_course->>'level' IS NULL
       OR p_course->>'level' NOT IN ('Pemula', 'Menengah') THEN
        RAISE EXCEPTION 'Personal course level is invalid';
    END IF;

    IF jsonb_typeof(p_course->'modules') IS DISTINCT FROM 'array'
       OR jsonb_array_length(p_course->'modules') <> 2 THEN
        RAISE EXCEPTION 'Personal course must contain exactly 2 modules';
    END IF;

    IF p_course ? 'prerequisites'
       AND jsonb_typeof(p_course->'prerequisites') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Personal course prerequisites must be an array';
    END IF;

    -- Validate the complete syllabus before creating any row. Every lesson in
    -- a newly created personal course starts pending, without content/answers.
    FOR v_module_index IN 0..1 LOOP
        v_module := p_course->'modules'->v_module_index;
        IF jsonb_typeof(v_module) IS DISTINCT FROM 'object'
           OR jsonb_typeof(v_module->'lessons') IS DISTINCT FROM 'array'
           OR jsonb_array_length(v_module->'lessons') <> 2 THEN
            RAISE EXCEPTION 'Each personal course module must contain exactly 2 lessons';
        END IF;

        v_module_id := v_module->>'id';
        IF v_module_id IS NULL OR btrim(v_module_id) = ''
           OR v_module_id = ANY(v_module_ids) THEN
            RAISE EXCEPTION 'Personal course module ids must be nonempty and unique';
        END IF;
        v_module_ids := array_append(v_module_ids, v_module_id);

        FOR v_lesson_index IN 0..1 LOOP
            v_lesson := v_module->'lessons'->v_lesson_index;
            IF jsonb_typeof(v_lesson) IS DISTINCT FROM 'object' THEN
                RAISE EXCEPTION 'Personal course lessons must be objects';
            END IF;

            v_lesson_id := v_lesson->>'id';
            IF v_lesson_id IS NULL OR btrim(v_lesson_id) = ''
               OR v_lesson_id = ANY(v_lesson_ids) THEN
                RAISE EXCEPTION 'Personal course lesson ids must be nonempty and unique';
            END IF;
            v_lesson_ids := array_append(v_lesson_ids, v_lesson_id);

            IF v_lesson->>'status' IS DISTINCT FROM 'pending' THEN
                RAISE EXCEPTION 'New personal course lessons must be pending';
            END IF;

            IF char_length(btrim(COALESCE(v_lesson->>'title', ''))) = 0
               OR jsonb_typeof(v_lesson->'objectives') IS DISTINCT FROM 'array' THEN
                RAISE EXCEPTION 'Personal course lesson title and objectives are required';
            END IF;

            v_minutes := COALESCE((v_lesson->>'minutes')::INTEGER, 0);
            IF v_minutes < 0 THEN
                RAISE EXCEPTION 'Personal course lesson minutes cannot be negative';
            END IF;
            v_estimated_minutes := v_estimated_minutes + v_minutes;
        END LOOP;
    END LOOP;

    -- Deterministic creation ids plus this transaction-scoped lock make retries
    -- safe even when two workers try to create the same course simultaneously.
    PERFORM pg_advisory_xact_lock(
        hashtext('save_personal_course'),
        hashtext(v_course_id)
    );

    SELECT c.creator_id, c.source_kind
    INTO v_existing_creator, v_existing_source_kind
    FROM public.courses c
    WHERE c.id = v_course_id
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing_source_kind <> 'generated'
           OR v_existing_creator IS DISTINCT FROM p_user_id THEN
            RAISE EXCEPTION 'Course id belongs to another owner or a curated course';
        END IF;

        -- Creation is idempotent: never replace a syllabus or delete generated
        -- content, questions, sources, enrollments, progress, or jobs on retry.
        RETURN;
    END IF;

    IF EXISTS (SELECT 1 FROM public.course_modules m WHERE m.id = ANY(v_module_ids)) THEN
        RAISE EXCEPTION 'A personal course module id is already in use';
    END IF;

    IF EXISTS (SELECT 1 FROM public.course_lessons l WHERE l.id = ANY(v_lesson_ids)) THEN
        RAISE EXCEPTION 'A personal course lesson id is already in use';
    END IF;

    INSERT INTO public.courses (
        id, creator_id, visibility, status, slug, title, category, level,
        description, outcome, audience, prerequisites, estimated_minutes,
        version, source_kind
    ) VALUES (
        v_course_id,
        p_user_id,
        'private',
        'published',
        COALESCE(NULLIF(btrim(p_course->>'slug'), ''), v_course_id),
        p_course->>'title',
        COALESCE(NULLIF(btrim(p_course->>'category'), ''), 'Kursus personal'),
        p_course->>'level',
        COALESCE(p_course->>'description', ''),
        p_course->>'outcome',
        COALESCE(p_course->>'audience', ''),
        COALESCE(p_course->'prerequisites', '[]'::jsonb),
        v_estimated_minutes,
        GREATEST(1, COALESCE((p_course->>'version')::INTEGER, 1)),
        'generated'
    );

    FOR v_module_index IN 0..1 LOOP
        v_module := p_course->'modules'->v_module_index;
        INSERT INTO public.course_modules (id, course_id, position, title, description)
        VALUES (
            v_module->>'id',
            v_course_id,
            v_module_index + 1,
            COALESCE(NULLIF(btrim(v_module->>'title'), ''), 'Modul ' || (v_module_index + 1)::TEXT),
            COALESCE(v_module->>'description', '')
        );

        FOR v_lesson_index IN 0..1 LOOP
            v_lesson := v_module->'lessons'->v_lesson_index;
            INSERT INTO public.course_lessons (
                id, module_id, position, title, summary, minutes, objectives,
                content_json, status, content_version, generation_error
            ) VALUES (
                v_lesson->>'id',
                v_module->>'id',
                v_lesson_index + 1,
                v_lesson->>'title',
                COALESCE(v_lesson->>'summary', ''),
                COALESCE((v_lesson->>'minutes')::INTEGER, 0),
                v_lesson->'objectives',
                '[]'::jsonb,
                'pending',
                GREATEST(1, COALESCE((v_lesson->>'contentVersion')::INTEGER, 1)),
                NULL
            );
        END LOOP;
    END LOOP;

    RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_personal_course(UUID, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_personal_course(UUID, JSONB) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.save_personal_course(UUID, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_personal_course(UUID, JSONB) TO service_role;

-- 7) Validated generated lesson content --------------------------------------
-- Remove the unfenced signature when upgrading an earlier patch installation.
DROP FUNCTION IF EXISTS public.save_generated_lesson(UUID, TEXT, TEXT, JSONB, JSONB);

CREATE OR REPLACE FUNCTION public.save_generated_lesson(
    p_user_id UUID,
    p_course_id TEXT,
    p_lesson_id TEXT,
    p_blocks JSONB,
    p_questions JSONB,
    p_job_attempt INTEGER,
    p_input_hash TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_course_creator UUID;
    v_course_source_kind TEXT;
    v_content_version INTEGER;
    v_job_id UUID;
    v_block JSONB;
    v_question JSONB;
    v_block_type TEXT;
    v_question_id TEXT;
    v_question_ids TEXT[] := ARRAY[]::TEXT[];
    v_answer NUMERIC;
    v_index INTEGER;
BEGIN
    IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Cannot save another user''s generated lesson';
    END IF;

    IF p_user_id IS NULL OR p_input_hash IS NULL OR btrim(p_input_hash) = '' THEN
        RAISE EXCEPTION 'A user and input hash are required';
    END IF;

    IF p_job_attempt IS NULL OR p_job_attempt < 1 THEN
        RAISE EXCEPTION 'A positive generation attempt token is required';
    END IF;

    -- Course-first locking also serializes this write with syllabus creation
    -- and generation-job transitions for the same owner/course.
    SELECT c.creator_id, c.source_kind
    INTO v_course_creator, v_course_source_kind
    FROM public.courses c
    WHERE c.id = p_course_id
    FOR UPDATE;

    IF NOT FOUND OR v_course_source_kind <> 'generated'
       OR v_course_creator IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION 'Personal course not found or access denied';
    END IF;

    SELECT l.content_version INTO v_content_version
    FROM public.course_lessons l
    JOIN public.course_modules m ON m.id = l.module_id
    WHERE l.id = p_lesson_id AND m.course_id = p_course_id
    FOR UPDATE OF l;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lesson not found in this course';
    END IF;

    -- The running job's attempt is a fencing token. A stale worker cannot
    -- publish after a newer claim, completion, or error transition.
    SELECT j.id INTO v_job_id
    FROM public.course_generation_jobs j
    WHERE j.user_id = p_user_id
      AND j.course_id = p_course_id
      AND j.lesson_id = p_lesson_id
      AND j.kind = 'lesson'
      AND j.input_hash = p_input_hash
      AND j.status = 'running'
      AND j.attempts = p_job_attempt
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active generation job not found or attempt token mismatch';
    END IF;

    IF jsonb_typeof(p_blocks) IS DISTINCT FROM 'array'
       OR jsonb_array_length(p_blocks) NOT BETWEEN 4 AND 6 THEN
        RAISE EXCEPTION 'Generated lesson must contain 4 to 6 blocks';
    END IF;

    FOR v_index IN 0..jsonb_array_length(p_blocks) - 1 LOOP
        v_block := p_blocks->v_index;
        IF jsonb_typeof(v_block) IS DISTINCT FROM 'object' THEN
            RAISE EXCEPTION 'Generated lesson blocks must be objects';
        END IF;

        v_block_type := v_block->>'type';
        IF v_block_type IS NULL
           OR v_block_type NOT IN ('paragraph', 'bullets', 'example', 'callout') THEN
            RAISE EXCEPTION 'Generated lesson block type is invalid';
        END IF;

        IF v_block_type = 'bullets' THEN
            IF jsonb_typeof(v_block->'items') IS DISTINCT FROM 'array'
               OR jsonb_array_length(v_block->'items') < 2
               OR EXISTS (
                   SELECT 1
                   FROM jsonb_array_elements(v_block->'items') AS item(value)
                   WHERE jsonb_typeof(item.value) <> 'string'
                      OR btrim(item.value #>> '{}') = ''
               ) THEN
                RAISE EXCEPTION 'Bullet blocks require at least 2 nonempty string items';
            END IF;
        ELSE
            IF char_length(btrim(COALESCE(v_block->>'text', ''))) = 0 THEN
                RAISE EXCEPTION 'Generated lesson block text is required';
            END IF;

            IF v_block_type IN ('example', 'callout')
               AND char_length(btrim(COALESCE(v_block->>'title', ''))) = 0 THEN
                RAISE EXCEPTION 'Example and callout blocks require a title';
            END IF;
        END IF;
    END LOOP;

    IF jsonb_typeof(p_questions) IS DISTINCT FROM 'array'
       OR jsonb_array_length(p_questions) <> 2 THEN
        RAISE EXCEPTION 'Generated lesson must contain exactly 2 questions';
    END IF;

    FOR v_index IN 0..1 LOOP
        v_question := p_questions->v_index;
        IF jsonb_typeof(v_question) IS DISTINCT FROM 'object' THEN
            RAISE EXCEPTION 'Generated lesson questions must be objects';
        END IF;

        v_question_id := v_question->>'id';
        IF v_question_id IS NULL OR btrim(v_question_id) = ''
           OR v_question_id = ANY(v_question_ids) THEN
            RAISE EXCEPTION 'Question ids must be nonempty and unique';
        END IF;
        v_question_ids := array_append(v_question_ids, v_question_id);

        IF char_length(btrim(COALESCE(v_question->>'prompt', ''))) = 0
           OR char_length(btrim(COALESCE(v_question->>'explanation', ''))) = 0 THEN
            RAISE EXCEPTION 'Question prompt and explanation are required';
        END IF;

        IF jsonb_typeof(v_question->'options') IS DISTINCT FROM 'array'
           OR jsonb_array_length(v_question->'options') <> 4
           OR EXISTS (
               SELECT 1
               FROM jsonb_array_elements(v_question->'options') AS opt(value)
               WHERE jsonb_typeof(opt.value) <> 'string'
                  OR btrim(opt.value #>> '{}') = ''
           ) THEN
            RAISE EXCEPTION 'Each question requires 4 nonempty string options';
        END IF;

        IF (
            SELECT COUNT(DISTINCT opt.value #>> '{}')
            FROM jsonb_array_elements(v_question->'options') AS opt(value)
        ) <> 4 THEN
            RAISE EXCEPTION 'Question options must be distinct';
        END IF;

        IF jsonb_typeof(v_question->'answer') IS DISTINCT FROM 'number' THEN
            RAISE EXCEPTION 'Question answer must be an integer from 0 to 3';
        END IF;

        v_answer := (v_question->>'answer')::NUMERIC;
        IF v_answer < 0 OR v_answer > 3 OR floor(v_answer) <> v_answer THEN
            RAISE EXCEPTION 'Question answer must be an integer from 0 to 3';
        END IF;
    END LOOP;

    IF EXISTS (
        SELECT 1 FROM public.lesson_questions q
        WHERE q.id = ANY(v_question_ids) AND q.lesson_id <> p_lesson_id
    ) THEN
        RAISE EXCEPTION 'A question id belongs to another lesson';
    END IF;

    -- Validation is complete. Replacement and publication now commit or roll
    -- back together, so a partial generated lesson can never become ready.
    DELETE FROM public.lesson_questions q
    WHERE q.lesson_id = p_lesson_id;

    FOR v_index IN 0..1 LOOP
        v_question := p_questions->v_index;
        INSERT INTO public.lesson_questions (
            id, lesson_id, version, position, prompt, options, answer, explanation
        ) VALUES (
            v_question->>'id',
            p_lesson_id,
            v_content_version,
            v_index + 1,
            v_question->>'prompt',
            v_question->'options',
            (v_question->>'answer')::INTEGER,
            v_question->>'explanation'
        );
    END LOOP;

    UPDATE public.course_lessons l
    SET content_json = p_blocks,
        status = 'ready',
        generation_error = NULL
    WHERE l.id = p_lesson_id;

    -- Publication and job completion are one transaction. Recheck the fencing
    -- token even though the course and job rows are already locked.
    UPDATE public.course_generation_jobs j
    SET status = 'done',
        error = NULL,
        updated_at = NOW()
    WHERE j.id = v_job_id
      AND j.status = 'running'
      AND j.attempts = p_job_attempt
      AND j.input_hash = p_input_hash;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Generation job changed during lesson publication';
    END IF;

    RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_generated_lesson(UUID, TEXT, TEXT, JSONB, JSONB, INTEGER, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_generated_lesson(UUID, TEXT, TEXT, JSONB, JSONB, INTEGER, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.save_generated_lesson(UUID, TEXT, TEXT, JSONB, JSONB, INTEGER, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_generated_lesson(UUID, TEXT, TEXT, JSONB, JSONB, INTEGER, TEXT) TO service_role;

-- 8) Generation-job leasing and completion -----------------------------------
CREATE OR REPLACE FUNCTION public.claim_course_lesson_generation(
    p_user_id UUID,
    p_course_id TEXT,
    p_lesson_id TEXT,
    p_input_hash TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_course_creator UUID;
    v_course_source_kind TEXT;
    v_job_id UUID;
    v_job_status TEXT;
    v_job_updated_at TIMESTAMPTZ;
    v_job_attempt INTEGER;
BEGIN
    IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Cannot claim another user''s lesson generation';
    END IF;

    IF p_user_id IS NULL OR p_input_hash IS NULL OR btrim(p_input_hash) = '' THEN
        RAISE EXCEPTION 'A user and input hash are required';
    END IF;

    SELECT c.creator_id, c.source_kind
    INTO v_course_creator, v_course_source_kind
    FROM public.courses c
    WHERE c.id = p_course_id
    FOR UPDATE;

    IF NOT FOUND OR v_course_source_kind <> 'generated'
       OR v_course_creator IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION 'Personal course not found or access denied';
    END IF;

    PERFORM 1
    FROM public.course_lessons l
    JOIN public.course_modules m ON m.id = l.module_id
    WHERE l.id = p_lesson_id AND m.course_id = p_course_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lesson not found in this course';
    END IF;

    -- The first key namespaces the lock to course generation; the second scopes
    -- it to one exact job. xact lock releases automatically on commit/rollback.
    PERFORM pg_advisory_xact_lock(
        hashtext('course_lesson_generation'),
        hashtext(p_user_id::TEXT || ':' || p_course_id || ':' || p_lesson_id || ':' || p_input_hash)
    );

    SELECT j.id, j.status, j.updated_at, j.attempts
    INTO v_job_id, v_job_status, v_job_updated_at, v_job_attempt
    FROM public.course_generation_jobs j
    WHERE j.user_id = p_user_id
      AND j.course_id = p_course_id
      AND j.lesson_id = p_lesson_id
      AND j.kind = 'lesson'
      AND j.input_hash = p_input_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.course_generation_jobs (
            user_id, course_id, lesson_id, kind, status, input_hash, attempts, error
        ) VALUES (
            p_user_id, p_course_id, p_lesson_id, 'lesson', 'running', p_input_hash, 1, NULL
        );
        RETURN 'claimed:1';
    END IF;

    IF v_job_status = 'done' THEN
        RETURN 'done';
    END IF;

    IF v_job_status = 'running'
       AND v_job_updated_at > NOW() - INTERVAL '5 minutes' THEN
        RETURN 'running';
    END IF;

    v_job_attempt := v_job_attempt + 1;

    UPDATE public.course_generation_jobs j
    SET status = 'running',
        attempts = v_job_attempt,
        error = NULL,
        updated_at = NOW()
    WHERE j.id = v_job_id;

    RETURN 'claimed:' || v_job_attempt::TEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_course_lesson_generation(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_course_lesson_generation(UUID, TEXT, TEXT, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_course_lesson_generation(UUID, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_course_lesson_generation(UUID, TEXT, TEXT, TEXT) TO service_role;

-- Remove the unfenced completion overload when upgrading an earlier patch.
DROP FUNCTION IF EXISTS public.finish_course_lesson_generation(UUID, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.finish_course_lesson_generation(
    p_job_user UUID,
    p_course_id TEXT,
    p_lesson_id TEXT,
    p_input_hash TEXT,
    p_job_attempt INTEGER,
    p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_course_creator UUID;
    v_course_source_kind TEXT;
BEGIN
    IF auth.uid() IS NOT NULL AND auth.uid() <> p_job_user THEN
        RAISE EXCEPTION 'Cannot finish another user''s lesson generation';
    END IF;

    IF p_job_user IS NULL OR p_input_hash IS NULL OR btrim(p_input_hash) = '' THEN
        RAISE EXCEPTION 'A user and input hash are required';
    END IF;

    IF p_job_attempt IS NULL OR p_job_attempt < 1 THEN
        RAISE EXCEPTION 'A positive generation attempt token is required';
    END IF;

    IF p_error IS NULL THEN
        RAISE EXCEPTION 'Successful publication must use save_generated_lesson';
    END IF;

    SELECT c.creator_id, c.source_kind
    INTO v_course_creator, v_course_source_kind
    FROM public.courses c
    WHERE c.id = p_course_id
    FOR UPDATE;

    IF NOT FOUND OR v_course_source_kind <> 'generated'
       OR v_course_creator IS DISTINCT FROM p_job_user THEN
        RAISE EXCEPTION 'Personal course not found or access denied';
    END IF;

    PERFORM 1
    FROM public.course_lessons l
    JOIN public.course_modules m ON m.id = l.module_id
    WHERE l.id = p_lesson_id AND m.course_id = p_course_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lesson not found in this course';
    END IF;

    -- Share the claim lock namespace so completion and stale-job takeover
    -- cannot update the same generation job concurrently.
    PERFORM pg_advisory_xact_lock(
        hashtext('course_lesson_generation'),
        hashtext(p_job_user::TEXT || ':' || p_course_id || ':' || p_lesson_id || ':' || p_input_hash)
    );

    UPDATE public.course_generation_jobs j
    SET status = 'error',
        error = p_error,
        updated_at = NOW()
    WHERE j.user_id = p_job_user
      AND j.course_id = p_course_id
      AND j.lesson_id = p_lesson_id
      AND j.kind = 'lesson'
      AND j.input_hash = p_input_hash
      AND j.status = 'running'
      AND j.attempts = p_job_attempt;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active generation job not found or attempt token mismatch';
    END IF;

    RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finish_course_lesson_generation(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finish_course_lesson_generation(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.finish_course_lesson_generation(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.finish_course_lesson_generation(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) TO service_role;

COMMIT;
