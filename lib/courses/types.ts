export type CourseLevel = "Pemula" | "Menengah";
export type CourseSourceKind = "curated" | "generated";

export type LessonBlock =
  | { type: "paragraph"; text: string }
  | { type: "bullets"; title?: string; items: string[] }
  | { type: "example"; title: string; text: string }
  | { type: "callout"; title: string; text: string };

export interface CourseQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface CourseSource {
  id: string;
  title: string;
  url: string;
  note?: string;
}

export interface CourseLesson {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  objectives: string[];
  blocks: LessonBlock[];
  questions: CourseQuestion[];
  sources: CourseSource[];
  status?: "pending" | "ready" | "error";
  contentVersion?: number;
}

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  lessons: CourseLesson[];
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  category: string;
  level: CourseLevel;
  description: string;
  outcome: string;
  audience: string;
  prerequisites: string[];
  estimatedMinutes: number;
  version: number;
  sourceKind: CourseSourceKind;
  modules: CourseModule[];
  sources: CourseSource[];
}

export interface CourseProgress {
  completedLessons: number;
  totalLessons: number;
  percent: number;
  currentLessonId: string | null;
}

export interface CourseSummary {
  id: string;
  slug: string;
  title: string;
  category: string;
  level: CourseLevel;
  description: string;
  outcome: string;
  estimatedMinutes: number;
  lessonCount: number;
  moduleCount: number;
  sourceKind: CourseSourceKind;
  progress: CourseProgress | null;
}

export interface LessonProgress {
  lessonId: string;
  status: "in_progress" | "completed";
  bestScore: number;
  completedAt: string | null;
}

export interface CourseOverview {
  course: Course;
  enrolled: boolean;
  progress: CourseProgress;
  lessons: LessonProgress[];
  storage: "supabase" | "local";
}

export interface LearnerQuestion {
  id: string;
  prompt: string;
  options: string[];
}

export interface QuestionResult {
  questionId: string;
  selectedAnswer: number | null;
  correctAnswer: number;
  isCorrect: boolean;
  explanation: string;
}

export interface AttemptResult {
  score: number;
  passed: boolean;
  correctAnswers: number;
  totalQuestions: number;
  xpAwarded: number;
  results: QuestionResult[];
  progress: CourseProgress;
  storage: "supabase" | "local";
}

export interface PersonalCourseInput {
  topic: string;
  goal: string;
  level: CourseLevel;
  minutesPerDay: number;
}

export function courseLessons(course: Course): CourseLesson[] {
  return course.modules.flatMap((module) => module.lessons);
}

export function summarizeCourse(course: Course, progress: CourseProgress | null = null): CourseSummary {
  const lessons = courseLessons(course);
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    category: course.category,
    level: course.level,
    description: course.description,
    outcome: course.outcome,
    estimatedMinutes: course.estimatedMinutes,
    lessonCount: lessons.length,
    moduleCount: course.modules.length,
    sourceKind: course.sourceKind,
    progress,
  };
}

export function buildCourseProgress(course: Course, lessons: LessonProgress[], currentLessonId?: string | null): CourseProgress {
  const all = courseLessons(course);
  const completed = new Set(lessons.filter((item) => item.status === "completed").map((item) => item.lessonId));
  const completedLessons = all.filter((lesson) => completed.has(lesson.id)).length;
  const next = all.find((lesson) => !completed.has(lesson.id) && lesson.status !== "pending");
  return {
    completedLessons,
    totalLessons: all.length,
    percent: all.length ? Math.round((completedLessons / all.length) * 100) : 0,
    currentLessonId: currentLessonId && all.some((lesson) => lesson.id === currentLessonId)
      ? currentLessonId
      : next?.id ?? all.find((lesson) => !completed.has(lesson.id))?.id ?? all.at(-1)?.id ?? null,
  };
}
