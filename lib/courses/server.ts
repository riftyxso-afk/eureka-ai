import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { db, isSupabaseConfigured } from "@/lib/supabase/admin";
import { CURATED_COURSES } from "./catalog";
import { generateLesson } from "./generator";
import {
  buildCourseProgress,
  courseLessons,
  summarizeCourse,
  type AttemptResult,
  type Course,
  type CourseLesson,
  type CourseOverview,
  type CourseSummary,
  type LessonProgress,
  type QuestionResult,
} from "./types";

const LOCAL_PATH = path.join(process.cwd(), "data", "courses.local.json");
const syncedCurated = new Set<string>();
const generationFlights = new Map<string, Promise<{ course: Course; lesson: CourseLesson }>>();

export class CourseOperationError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

type LocalEnrollment = { userId: string; courseId: string; courseVersion: number; currentLessonId: string | null };
type LocalProgress = LessonProgress & { userId: string; courseId: string };
type LocalAttempt = { userId: string; courseId: string; lessonId: string; key: string; result: AttemptResult };
type LocalState = {
  customCourses: Course[];
  courseOwners: Record<string, string>;
  enrollments: LocalEnrollment[];
  progress: LocalProgress[];
  attempts: LocalAttempt[];
  rewards: string[];
  usage: { userId: string; feature: string; date: string; count: number }[];
};

const EMPTY_LOCAL: LocalState = { customCourses: [], courseOwners: {}, enrollments: [], progress: [], attempts: [], rewards: [], usage: [] };
let localWriteQueue: Promise<unknown> = Promise.resolve();

async function readLocal(): Promise<LocalState> {
  try {
    const parsed = JSON.parse(await readFile(LOCAL_PATH, "utf8")) as Partial<LocalState>;
    return {
      customCourses: Array.isArray(parsed.customCourses) ? parsed.customCourses : [],
      courseOwners: parsed.courseOwners && typeof parsed.courseOwners === "object" ? parsed.courseOwners : {},
      enrollments: Array.isArray(parsed.enrollments) ? parsed.enrollments : [],
      progress: Array.isArray(parsed.progress) ? parsed.progress : [],
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
      rewards: Array.isArray(parsed.rewards) ? parsed.rewards : [],
      usage: Array.isArray(parsed.usage) ? parsed.usage : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(EMPTY_LOCAL);
    throw error;
  }
}

async function mutateLocal<T>(operation: (state: LocalState) => T | Promise<T>): Promise<T> {
  const run = localWriteQueue.then(async () => {
    const state = await readLocal();
    const result = await operation(state);
    await mkdir(path.dirname(LOCAL_PATH), { recursive: true });
    const temporary = `${LOCAL_PATH}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, JSON.stringify(state, null, 2), "utf8");
    await rename(temporary, LOCAL_PATH);
    return result;
  });
  localWriteQueue = run.catch(() => undefined);
  return run;
}

function isMissingSchema(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const item = error as { code?: string };
  // Never hide permission, validation, or network failures behind another store.
  return ["42P01", "42883", "PGRST202", "PGRST205"].includes(item.code ?? "");
}

async function supabaseOrLocal<T>(supabaseOperation: () => Promise<T>, localOperation: () => Promise<T>): Promise<T> {
  if (isSupabaseConfigured()) {
    try {
      return await supabaseOperation();
    } catch (error) {
      if (process.env.NODE_ENV === "production" || !isMissingSchema(error)) throw error;
      console.warn("[courses] Migrasi belum tersedia; memakai penyimpanan lokal pengembangan.");
    }
  }
  if (process.env.NODE_ENV === "production") throw new Error("Penyimpanan kursus belum dikonfigurasi.");
  return localOperation();
}

function findCurated(courseId: string): Course | null {
  return CURATED_COURSES.find((course) => course.id === courseId || course.slug === courseId) ?? null;
}

function assertAccess(course: Course & { creatorId?: string | null; visibility?: string }, userId: string): Course {
  if (course.creatorId && course.creatorId !== userId) throw new Error("Kursus privat ini bukan milikmu.");
  if (!course.creatorId && course.visibility && course.visibility !== "published") throw new Error("Kursus belum tersedia.");
  return course;
}

function rowToCourse(row: Record<string, unknown>, modules: Record<string, unknown>[], lessons: Record<string, unknown>[], questions: Record<string, unknown>[], sources: Record<string, unknown>[]): Course & { creatorId: string | null; visibility: string } {
  const lessonSources = (lessonId: string) => sources.filter((source) => source.lesson_id === lessonId).map((source) => ({ id: String(source.id), title: String(source.title), url: String(source.url), note: source.note ? String(source.note) : undefined }));
  return {
    id: String(row.id), slug: String(row.slug), title: String(row.title), category: String(row.category),
    level: row.level === "Menengah" ? "Menengah" : "Pemula", description: String(row.description ?? ""),
    outcome: String(row.outcome ?? ""), audience: String(row.audience ?? ""),
    prerequisites: Array.isArray(row.prerequisites) ? row.prerequisites.map(String) : [],
    estimatedMinutes: Number(row.estimated_minutes ?? 0), version: Number(row.version ?? 1),
    sourceKind: row.source_kind === "generated" ? "generated" : "curated",
    creatorId: row.creator_id ? String(row.creator_id) : null, visibility: String(row.visibility),
    sources: sources.filter((source) => !source.lesson_id).map((source) => ({ id: String(source.id), title: String(source.title), url: String(source.url), note: source.note ? String(source.note) : undefined })),
    modules: modules.sort((a, b) => Number(a.position) - Number(b.position)).map((module) => ({
      id: String(module.id), title: String(module.title), description: String(module.description ?? ""),
      lessons: lessons.filter((lesson) => lesson.module_id === module.id).sort((a, b) => Number(a.position) - Number(b.position)).map((lesson) => ({
        id: String(lesson.id), title: String(lesson.title), summary: String(lesson.summary ?? ""), minutes: Number(lesson.minutes ?? 5),
        objectives: Array.isArray(lesson.objectives) ? lesson.objectives.map(String) : [],
        blocks: Array.isArray(lesson.content_json) ? lesson.content_json as CourseLesson["blocks"] : [],
        questions: questions.filter((question) => question.lesson_id === lesson.id && Number(question.version) === Number(lesson.content_version ?? 1)).sort((a, b) => Number(a.position) - Number(b.position)).map((question) => ({
          id: String(question.id), prompt: String(question.prompt), options: Array.isArray(question.options) ? question.options.map(String) : [],
          answer: Number(question.answer), explanation: String(question.explanation ?? ""),
        })),
        sources: lessonSources(String(lesson.id)), status: lesson.status === "ready" ? "ready" : lesson.status === "error" ? "error" : "pending",
        contentVersion: Number(lesson.content_version ?? 1),
      })),
    })),
  };
}

async function loadCustomCourse(userId: string, courseId: string): Promise<Course | null> {
  return supabaseOrLocal(async () => {
    const client = db();
    const { data: row, error } = await client.from("courses").select("*").eq("id", courseId).maybeSingle();
    if (error) throw error;
    if (!row || row.source_kind !== "generated") return null;
    if (row.creator_id !== userId) throw new Error("Kursus privat ini bukan milikmu.");
    const [{ data: modules, error: moduleError }, { data: lessons, error: lessonError }, { data: sources, error: sourceError }] = await Promise.all([
      client.from("course_modules").select("*").eq("course_id", courseId),
      client.from("course_lessons").select("*").in("module_id", (await client.from("course_modules").select("id").eq("course_id", courseId)).data?.map((item) => item.id) ?? [""]),
      client.from("course_sources").select("*").eq("course_id", courseId),
    ]);
    if (moduleError) throw moduleError;
    if (lessonError) throw lessonError;
    if (sourceError) throw sourceError;
    const lessonIds = (lessons ?? []).map((item) => item.id);
    const { data: questions, error: questionError } = lessonIds.length ? await client.from("lesson_questions").select("*").in("lesson_id", lessonIds) : { data: [], error: null };
    if (questionError) throw questionError;
    return rowToCourse(row, modules ?? [], lessons ?? [], questions ?? [], sources ?? []);
  }, async () => {
    const state = await readLocal();
    const course = state.customCourses.find((item) => item.id === courseId);
    return course ? assertAccess({ ...course, creatorId: state.courseOwners[courseId] ?? null, visibility: "private" }, userId) : null;
  });
}

async function getCourse(userId: string, courseId: string): Promise<Course | null> {
  return findCurated(courseId) ?? loadCustomCourse(userId, courseId);
}

async function saveCourse(course: Course, userId: string | null): Promise<void> {
  await supabaseOrLocal(async () => {
    const client = db();
    if (userId) {
      const { error } = await client.rpc("save_personal_course", { p_user_id: userId, p_course: course });
      if (error) throw error;
      return;
    }
    const { error } = await client.from("courses").upsert({
      id: course.id, creator_id: userId, visibility: userId ? "private" : "published", status: "published",
      slug: course.slug, title: course.title, category: course.category, level: course.level, description: course.description,
      outcome: course.outcome, audience: course.audience, prerequisites: course.prerequisites, estimated_minutes: course.estimatedMinutes,
      version: course.version, source_kind: course.sourceKind, updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    for (const [moduleIndex, module] of course.modules.entries()) {
      const { error: moduleError } = await client.from("course_modules").upsert({ id: module.id, course_id: course.id, position: moduleIndex + 1, title: module.title, description: module.description });
      if (moduleError) throw moduleError;
      for (const [lessonIndex, lesson] of module.lessons.entries()) {
        const { error: lessonError } = await client.from("course_lessons").upsert({
          id: lesson.id, module_id: module.id, position: lessonIndex + 1, title: lesson.title, summary: lesson.summary,
          minutes: lesson.minutes, objectives: lesson.objectives, content_json: lesson.blocks, status: lesson.status ?? "ready",
          content_version: lesson.contentVersion ?? 1, generation_error: null,
        });
        if (lessonError) throw lessonError;
        for (const [questionIndex, question] of lesson.questions.entries()) {
          const { error: questionError } = await client.from("lesson_questions").upsert({ id: question.id, lesson_id: lesson.id, version: lesson.contentVersion ?? 1, position: questionIndex + 1, prompt: question.prompt, options: question.options, answer: question.answer, explanation: question.explanation });
          if (questionError) throw questionError;
        }
      }
    }
    const sourceRows = [...course.sources.map((source) => ({ ...source, lessonId: null })), ...courseLessons(course).flatMap((lesson) => lesson.sources.map((source) => ({ ...source, lessonId: lesson.id })))];
    const { error: deleteSourcesError } = await client.from("course_sources").delete().eq("course_id", course.id);
    if (deleteSourcesError) throw deleteSourcesError;
    if (sourceRows.length) {
      const { error: sourceError } = await client.from("course_sources").insert(sourceRows.map((source) => ({ course_id: course.id, lesson_id: source.lessonId, title: source.title, url: source.url, note: source.note ?? null })));
      if (sourceError) throw sourceError;
    }
  }, async () => {
    if (!userId) return;
    await mutateLocal((state) => {
      const index = state.customCourses.findIndex((item) => item.id === course.id);
      if (state.courseOwners[course.id] && state.courseOwners[course.id] !== userId) throw new Error("Kursus privat ini bukan milikmu.");
      state.courseOwners[course.id] = userId;
      if (index < 0) state.customCourses.push(course);
    });
  });
}

async function ensureCuratedSynced(course: Course): Promise<void> {
  if (course.sourceKind !== "curated" || syncedCurated.has(course.id) || !isSupabaseConfigured()) return;
  await saveCourse(course, null);
  syncedCurated.add(course.id);
}

type EnrollmentState = { enrolled: boolean; lessons: LessonProgress[]; currentLessonId: string | null; storage: "supabase" | "local" };

async function getEnrollmentProgress(userId: string, course: Course): Promise<EnrollmentState> {
  return supabaseOrLocal<EnrollmentState>(async () => {
    const client = db();
    const { data: enrollment, error } = await client.from("course_enrollments").select("id,current_lesson_id").eq("user_id", userId).eq("course_id", course.id).maybeSingle();
    if (error) throw error;
    if (!enrollment) return { enrolled: false, lessons: [], currentLessonId: null, storage: "supabase" as const };
    const { data: rows, error: progressError } = await client.from("lesson_progress").select("lesson_id,status,best_score,completed_at").eq("enrollment_id", enrollment.id);
    if (progressError) throw progressError;
    return { enrolled: true, lessons: (rows ?? []).map((row) => ({ lessonId: row.lesson_id, status: row.status === "completed" ? "completed" as const : "in_progress" as const, bestScore: Number(row.best_score ?? 0), completedAt: row.completed_at ?? null })), currentLessonId: enrollment.current_lesson_id ?? null, storage: "supabase" as const };
  }, async () => {
    const state = await readLocal();
    const enrollment = state.enrollments.find((item) => item.userId === userId && item.courseId === course.id);
    return { enrolled: Boolean(enrollment), lessons: state.progress.filter((item) => item.userId === userId && item.courseId === course.id).map(({ lessonId, status, bestScore, completedAt }) => ({ lessonId, status, bestScore, completedAt })), currentLessonId: enrollment?.currentLessonId ?? null, storage: "local" as const };
  });
}

export async function getCourseCatalog(userId: string): Promise<{ courses: CourseSummary[]; storage: "supabase" | "local" }> {
  const personal = await supabaseOrLocal(async () => {
    const { data, error } = await db().from("courses").select("id").eq("creator_id", userId).eq("source_kind", "generated").order("updated_at", { ascending: false });
    if (error) throw error;
    const result: Course[] = [];
    for (const row of data ?? []) {
      const course = await loadCustomCourse(userId, row.id);
      if (course) result.push(course);
    }
    return result;
  }, async () => {
    const state = await readLocal();
    return state.customCourses.filter((course) => state.courseOwners[course.id] === userId);
  });
  const courses = [...personal, ...CURATED_COURSES];
  const summaries: CourseSummary[] = [];
  let storage: "supabase" | "local" = isSupabaseConfigured() ? "supabase" : "local";
  for (const course of courses) {
    const state = await getEnrollmentProgress(userId, course);
    storage = state.storage;
    summaries.push(summarizeCourse(course, state.enrolled ? buildCourseProgress(course, state.lessons, state.currentLessonId) : null));
  }
  return { courses: summaries, storage };
}

export async function getCourseOverview(userId: string, courseId: string): Promise<CourseOverview | null> {
  const course = await getCourse(userId, courseId);
  if (!course) return null;
  const state = await getEnrollmentProgress(userId, course);
  return { course, enrolled: state.enrolled, lessons: state.lessons, progress: buildCourseProgress(course, state.lessons, state.currentLessonId), storage: state.storage };
}

export async function enrollInCourse(userId: string, courseId: string): Promise<CourseOverview | null> {
  const course = await getCourse(userId, courseId);
  if (!course) return null;
  await supabaseOrLocal(async () => {
    await ensureCuratedSynced(course);
    const first = courseLessons(course).find((lesson) => lesson.status !== "pending");
    const { error } = await db().from("course_enrollments").upsert({ user_id: userId, course_id: course.id, course_version: course.version, current_lesson_id: first?.id ?? null, updated_at: new Date().toISOString() }, { onConflict: "user_id,course_id", ignoreDuplicates: true });
    if (error) throw error;
  }, () => mutateLocal((state) => {
    if (!state.enrollments.some((item) => item.userId === userId && item.courseId === course.id)) {
      state.enrollments.push({ userId, courseId: course.id, courseVersion: course.version, currentLessonId: courseLessons(course).find((lesson) => lesson.status !== "pending")?.id ?? null });
    }
  }));
  return getCourseOverview(userId, course.id);
}

export async function getLessonForUser(userId: string, courseId: string, lessonId: string): Promise<{ course: Course; lesson: CourseLesson } | null> {
  const course = await getCourse(userId, courseId);
  const lesson = course && courseLessons(course).find((item) => item.id === lessonId);
  return course && lesson ? { course, lesson } : null;
}

function gradeLesson(course: Course, lesson: CourseLesson, answers: Record<string, number>): Omit<AttemptResult, "progress" | "storage"> {
  const results: QuestionResult[] = lesson.questions.map((question) => {
    const selected = Number.isInteger(answers[question.id]) ? answers[question.id] : null;
    return { questionId: question.id, selectedAnswer: selected, correctAnswer: question.answer, isCorrect: selected === question.answer, explanation: question.explanation };
  });
  const correctAnswers = results.filter((result) => result.isCorrect).length;
  const score = results.length ? Math.round((correctAnswers / results.length) * 100) : 0;
  return { score, passed: results.length > 0 && score >= 70, correctAnswers, totalQuestions: results.length, xpAwarded: 0, results };
}

export async function submitAttempt(userId: string, courseId: string, lessonId: string, answers: Record<string, number>, idempotencyKey: string): Promise<AttemptResult> {
  const found = await getLessonForUser(userId, courseId, lessonId);
  if (!found || found.lesson.status === "pending" || found.lesson.status === "error" || found.lesson.questions.length !== 2) throw new Error("Pelajaran belum tersedia.");
  const { course, lesson } = found;
  if (!/^[a-zA-Z0-9:_-]{8,100}$/.test(idempotencyKey)) throw new Error("Kunci percobaan tidak valid.");
  const cleanAnswers = Object.fromEntries(lesson.questions.map((question) => [question.id, Number(answers[question.id])]));
  if (Object.values(cleanAnswers).some((answer) => !Number.isInteger(answer) || answer < 0 || answer > 3)) throw new Error("Jawab semua soal sebelum mengirim.");
  return supabaseOrLocal(async () => {
    await ensureCuratedSynced(course);
    const { data, error } = await db().rpc("submit_course_attempt", { p_user_id: userId, p_course_id: course.id, p_lesson_id: lesson.id, p_answers: cleanAnswers, p_idempotency_key: idempotencyKey });
    if (error) throw error;
    const result = data as AttemptResult;
    const overview = await getCourseOverview(userId, course.id);
    return { ...result, progress: overview?.progress ?? buildCourseProgress(course, []), storage: "supabase" as const };
  }, () => mutateLocal((state) => {
    const previous = state.attempts.find((item) => item.userId === userId && item.lessonId === lesson.id && item.key === idempotencyKey);
    if (previous) return { ...previous.result, xpAwarded: 0 };
    if (!state.enrollments.some((item) => item.userId === userId && item.courseId === course.id)) throw new Error("Ikuti kursus terlebih dahulu.");
    const grade = gradeLesson(course, lesson, cleanAnswers);
    const rewardKey = `${userId}:${lesson.id}:v${lesson.contentVersion ?? 1}`;
    const firstCompletion = grade.passed && !state.rewards.includes(rewardKey);
    if (firstCompletion) state.rewards.push(rewardKey);
    const current = state.progress.find((item) => item.userId === userId && item.courseId === course.id && item.lessonId === lesson.id);
    const progressRow: LocalProgress = { userId, courseId: course.id, lessonId: lesson.id, status: grade.passed || current?.status === "completed" ? "completed" : "in_progress", bestScore: Math.max(current?.bestScore ?? 0, grade.score), completedAt: grade.passed ? current?.completedAt ?? new Date().toISOString() : current?.completedAt ?? null };
    if (current) Object.assign(current, progressRow); else state.progress.push(progressRow);
    const enrollment = state.enrollments.find((item) => item.userId === userId && item.courseId === course.id);
    const next = courseLessons(course).find((item) => item.id !== lesson.id && !state.progress.some((row) => row.userId === userId && row.lessonId === item.id && row.status === "completed"));
    if (enrollment && grade.passed) enrollment.currentLessonId = next?.id ?? lesson.id;
    const progress = buildCourseProgress(course, state.progress.filter((item) => item.userId === userId && item.courseId === course.id), enrollment?.currentLessonId);
    const result: AttemptResult = { ...grade, xpAwarded: 0, progress, storage: "local" };
    state.attempts.push({ userId, courseId: course.id, lessonId: lesson.id, key: idempotencyKey, result });
    return result;
  }));
}

export async function savePersonalCourse(userId: string, course: Course): Promise<void> {
  if (course.sourceKind !== "generated" || !course.id.startsWith("custom-")) throw new Error("Kursus personal tidak valid.");
  await saveCourse(course, userId);
}

export async function updateGeneratedLesson(userId: string, courseId: string, lesson: CourseLesson, lease: { attempt: number; inputHash: string }): Promise<void> {
  const course = await loadCustomCourse(userId, courseId);
  if (!course) throw new Error("Kursus personal tidak ditemukan.");
  const ownerLesson = courseLessons(course).find((item) => item.id === lesson.id);
  if (!ownerLesson) throw new Error("Pelajaran tidak ditemukan dalam kursus ini.");
  await supabaseOrLocal(async () => {
    const { error } = await db().rpc("save_generated_lesson", { p_user_id: userId, p_course_id: courseId, p_lesson_id: lesson.id, p_blocks: lesson.blocks, p_questions: lesson.questions, p_job_attempt: lease.attempt, p_input_hash: lease.inputHash });
    if (error) throw error;
  }, () => mutateLocal((state) => {
    const localCourse = state.customCourses.find((item) => item.id === courseId);
    const target = localCourse && courseLessons(localCourse).find((item) => item.id === lesson.id);
    if (target) Object.assign(target, lesson);
  }));
}

export async function generateLessonForUser(userId: string, courseId: string, lessonId: string): Promise<{ course: Course; lesson: CourseLesson }> {
  const key = `${userId}:${courseId}:${lessonId}`;
  const active = generationFlights.get(key);
  if (active) return active;
  const work = (async () => {
    const found = await getLessonForUser(userId, courseId, lessonId);
    if (!found || found.course.sourceKind !== "generated") throw new CourseOperationError("Pelajaran personal tidak ditemukan.", 404);
    if (found.lesson.status === "ready" && found.lesson.questions.length === 2) return found;
    const inputHash = `content-v${found.lesson.contentVersion ?? 1}`;
    const claim = await supabaseOrLocal(async () => {
      const { data, error } = await db().rpc("claim_course_lesson_generation", { p_user_id: userId, p_course_id: courseId, p_lesson_id: lessonId, p_input_hash: inputHash });
      if (error) throw error;
      return String(data);
    }, async () => "claimed:1");
    if (claim === "running") throw new CourseOperationError("Pelajaran sedang disusun di tab lain. Tunggu sebentar lalu muat ulang.", 409);
    if (claim === "done") {
      const ready = await getLessonForUser(userId, courseId, lessonId);
      if (ready?.lesson.status === "ready" && ready.lesson.questions.length === 2) return ready;
      throw new CourseOperationError("Pelajaran belum lengkap. Coba lagi sebentar.", 409);
    }
    const claimMatch = /^claimed:(\d+)$/.exec(claim);
    if (!claimMatch) throw new CourseOperationError("Job penyusunan pelajaran tidak valid. Jalankan migrasi kursus terbaru.", 500);
    const attempt = Number(claimMatch[1]);
    async function finishWithError(errorText: string) {
      await supabaseOrLocal(async () => {
        const { error } = await db().rpc("finish_course_lesson_generation", { p_job_user: userId, p_course_id: courseId, p_lesson_id: lessonId, p_input_hash: inputHash, p_job_attempt: attempt, p_error: errorText });
        if (error) throw error;
      }, async () => undefined);
    }
    try {
      if (!await consumeCourseAiQuota(userId, "generate", 12)) throw new CourseOperationError("Batas AI hari ini tercapai. Coba lagi besok; kursus gratis lain tetap terbuka.", 429);
      const lesson = await generateLesson(found.course, found.lesson);
      await updateGeneratedLesson(userId, courseId, lesson, { attempt, inputHash });
      return { course: found.course, lesson };
    } catch (error) {
      await finishWithError(error instanceof Error ? error.message.slice(0, 500) : "Generation failed").catch((failure) => console.error("[courses] generation cleanup", failure));
      throw error;
    }
  })();
  generationFlights.set(key, work);
  try { return await work; } finally { generationFlights.delete(key); }
}

export async function consumeCourseAiQuota(userId: string, feature: "tutor" | "generate" | "create", limit: number): Promise<boolean> {
  const date = new Date().toISOString().slice(0, 10);
  return supabaseOrLocal(async () => {
    const { data, error } = await db().rpc("consume_course_ai_quota", { p_user_id: userId, p_feature: feature, p_limit: limit, p_used_on: date });
    if (error) throw error;
    return data === true;
  }, () => mutateLocal((state) => {
    const row = state.usage.find((item) => item.userId === userId && item.feature === feature && item.date === date);
    if ((row?.count ?? 0) >= limit) return false;
    if (row) row.count += 1; else state.usage.push({ userId, feature, date, count: 1 });
    return true;
  }));
}
