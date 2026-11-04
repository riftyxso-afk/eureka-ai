"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  Info,
  Layers,
  Library,
  ListOrdered,
  Loader2,
  Lock,
  Play,
  RotateCcw,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import type {
  Course,
  CourseLesson,
  CourseModule,
  CourseOverview,
  CourseSource,
  LessonProgress,
} from "@/lib/courses/types";
import "../kursus.css";

const CREATION_WARNING_KEY = "eureka-course-creation-warning";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function wholeNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : fallback;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeSource(value: unknown): CourseSource | null {
  if (!isRecord(value)) return null;
  const title = text(value.title);
  const url = safeHttpUrl(value.url);
  if (!title || !url) return null;
  return { id: text(value.id, url), title, url, note: text(value.note) || undefined };
}

function normalizeSources(value: unknown): CourseSource[] {
  return Array.isArray(value)
    ? value.map(normalizeSource).filter((source): source is CourseSource => source !== null)
    : [];
}

function normalizeLesson(value: unknown): CourseLesson | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  const title = text(value.title);
  if (!id || !title) return null;
  const status = value.status === "ready" || value.status === "pending" || value.status === "error" ? value.status : undefined;

  return {
    id,
    title,
    summary: text(value.summary),
    minutes: wholeNumber(value.minutes),
    objectives: stringList(value.objectives),
    // Overview responses deliberately contain syllabus data only.
    blocks: [],
    questions: [],
    sources: normalizeSources(value.sources),
    status,
    contentVersion: wholeNumber(value.contentVersion, 1),
  };
}

function normalizeCourse(value: unknown): Course | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  const title = text(value.title);
  if (!id || !title) return null;

  const modules: CourseModule[] = [];
  if (Array.isArray(value.modules)) {
    for (const moduleValue of value.modules) {
      if (!isRecord(moduleValue)) continue;
      const moduleId = text(moduleValue.id);
      const moduleTitle = text(moduleValue.title);
      if (!moduleId || !moduleTitle) continue;
      const lessons = Array.isArray(moduleValue.lessons)
        ? moduleValue.lessons.map(normalizeLesson).filter((lesson): lesson is CourseLesson => lesson !== null)
        : [];
      modules.push({ id: moduleId, title: moduleTitle, description: text(moduleValue.description), lessons });
    }
  }

  const calculatedMinutes = modules.flatMap((module) => module.lessons).reduce((total, lesson) => total + lesson.minutes, 0);
  return {
    id,
    slug: text(value.slug, id),
    title,
    category: text(value.category, "Umum"),
    level: value.level === "Menengah" ? "Menengah" : "Pemula",
    description: text(value.description),
    outcome: text(value.outcome),
    audience: text(value.audience),
    prerequisites: stringList(value.prerequisites),
    estimatedMinutes: wholeNumber(value.estimatedMinutes, calculatedMinutes),
    version: wholeNumber(value.version, 1) || 1,
    sourceKind: value.sourceKind === "generated" ? "generated" : "curated",
    modules,
    sources: normalizeSources(value.sources),
  };
}

function normalizeLessonProgress(value: unknown): LessonProgress | null {
  if (!isRecord(value)) return null;
  const lessonId = text(value.lessonId);
  if (!lessonId) return null;
  return {
    lessonId,
    status: value.status === "completed" ? "completed" : "in_progress",
    bestScore: wholeNumber(value.bestScore),
    completedAt: text(value.completedAt) || null,
  };
}

/** Treat the API as untrusted and derive display progress from lessons that exist. */
function normalizeOverview(value: unknown): CourseOverview | null {
  if (!isRecord(value) || !isRecord(value.overview)) return null;
  const raw = value.overview;
  const course = normalizeCourse(raw.course);
  if (!course) return null;

  const allLessons = course.modules.flatMap((module) => module.lessons);
  const knownLessonIds = new Set(allLessons.map((lesson) => lesson.id));
  const lessonProgress = Array.isArray(raw.lessons)
    ? raw.lessons.map(normalizeLessonProgress).filter((item): item is LessonProgress => item !== null)
    : [];
  const completed = new Set(
    lessonProgress.filter((item) => item.status === "completed" && knownLessonIds.has(item.lessonId)).map((item) => item.lessonId),
  );
  const progressRecord = isRecord(raw.progress) ? raw.progress : {};
  const reportedCurrent = text(progressRecord.currentLessonId);
  const firstAvailable = allLessons.find((lesson) => !completed.has(lesson.id) && lesson.status !== "pending" && lesson.status !== "error");
  const firstIncomplete = allLessons.find((lesson) => !completed.has(lesson.id));
  const currentLessonId = knownLessonIds.has(reportedCurrent)
    ? reportedCurrent
    : firstAvailable?.id ?? firstIncomplete?.id ?? allLessons.at(-1)?.id ?? null;
  const totalLessons = allLessons.length;
  const completedLessons = completed.size;

  return {
    course,
    enrolled: raw.enrolled === true,
    lessons: lessonProgress,
    progress: {
      completedLessons,
      totalLessons,
      percent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
      currentLessonId,
    },
    storage: raw.storage === "local" ? "local" : "supabase",
  };
}

function lessonPath(courseId: string, lessonId: string): string {
  return `/dashboard/kursus/${encodeURIComponent(courseId)}/pelajaran/${encodeURIComponent(lessonId)}`;
}

function formatMinutes(value: number): string {
  const total = wholeNumber(value);
  if (total < 60) return `${total} menit`;
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  return remainder ? `${hours} jam ${remainder} menit` : `${hours} jam`;
}

function consumeCreationWarning(courseId: string): string {
  try {
    const saved = window.sessionStorage.getItem(CREATION_WARNING_KEY);
    if (!saved) return "";
    const parsed: unknown = JSON.parse(saved);
    if (!isRecord(parsed)) {
      window.sessionStorage.removeItem(CREATION_WARNING_KEY);
      return "";
    }
    if (text(parsed.courseId) !== courseId) return "";
    window.sessionStorage.removeItem(CREATION_WARNING_KEY);
    return text(parsed.warning);
  } catch {
    return "";
  }
}

function lessonDisplay(lesson: CourseLesson, isCompleted: boolean) {
  if (isCompleted) return { label: "Selesai", tone: "completed", action: "Buka lagi" };
  if (lesson.status === "pending" || lesson.status === "error") {
    return { label: "Menunggu disusun", tone: "pending", action: "Buka untuk menyusun" };
  }
  return { label: "Tersedia", tone: "available", action: "Buka pelajaran" };
}

export default function CourseDetailPage() {
  const router = useRouter();
  const startRequestRef = useRef(false);
  const params = useParams<{ courseId: string }>();
  const courseId = typeof params.courseId === "string" ? params.courseId : "";
  const [overview, setOverview] = useState<CourseOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [creationNotice, setCreationNotice] = useState("");
  const [starting, setStarting] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!courseId) {
      setLoading(false);
      setLoadError("Alamat kursus tidak lengkap. Kembali ke katalog dan pilih kursus lagi.");
      return;
    }

    const controller = new AbortController();
    async function loadCourse() {
      setLoading(true);
      setLoadError("");
      setActionError("");
      try {
        const response = await apiFetch(`/api/courses/${encodeURIComponent(courseId)}`, { signal: controller.signal });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message = isRecord(payload) ? text(payload.error, "Detail kursus belum dapat dimuat.") : "Detail kursus belum dapat dimuat.";
          throw new Error(message);
        }
        const nextOverview = normalizeOverview(payload);
        if (!nextOverview) throw new Error("Data detail kursus belum lengkap. Coba muat ulang.");
        if (controller.signal.aborted) return;
        setOverview(nextOverview);
        setCreationNotice(consumeCreationWarning(nextOverview.course.id));
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : "Detail kursus belum dapat dimuat.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadCourse();
    return () => controller.abort();
  }, [courseId, retryToken]);

  const courseTitle = overview?.course.title ?? "";
  useEffect(() => {
    if (!courseTitle) return;
    const previousTitle = document.title;
    document.title = `${courseTitle} | Kursus Eureka`;
    return () => {
      document.title = previousTitle;
    };
  }, [courseTitle]);

  const completedLessonIds = useMemo(
    () => new Set(overview?.lessons.filter((item) => item.status === "completed").map((item) => item.lessonId) ?? []),
    [overview],
  );

  const sources = useMemo(() => {
    if (!overview) return [];
    const allSources = [
      ...overview.course.sources,
      ...overview.course.modules.flatMap((module) => module.lessons.flatMap((lesson) => lesson.sources)),
    ];
    return Array.from(new Map(allSources.map((source) => [source.url, source])).values());
  }, [overview]);

  const startCourse = async () => {
    if (!overview || starting || startRequestRef.current || overview.progress.totalLessons === 0) return;
    startRequestRef.current = true;
    setStarting(true);
    setActionError("");

    try {
      const response = await apiFetch(`/api/courses/${encodeURIComponent(overview.course.id)}`, { method: "POST" });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = isRecord(payload) ? text(payload.error, "Kursus belum dapat ditambahkan ke daftar belajarmu.") : "Kursus belum dapat ditambahkan ke daftar belajarmu.";
        throw new Error(message);
      }
      const nextOverview = normalizeOverview(payload);
      if (!nextOverview) throw new Error("Kursus sudah diproses, tetapi ruang belajar belum dapat dibuka. Muat ulang halaman.");
      setOverview(nextOverview);

      const nextLessonId = nextOverview.progress.currentLessonId;
      if (!nextLessonId) throw new Error("Kursus ini belum memiliki pelajaran untuk dibuka.");
      router.push(lessonPath(nextOverview.course.id, nextLessonId));
      // Keep the button pending until navigation completes to prevent duplicate posts.
    } catch (error) {
      startRequestRef.current = false;
      setActionError(error instanceof Error ? error.message : "Ruang belajar belum dapat dibuka. Coba lagi.");
      setStarting(false);
    }
  };

  const actionLabel = !overview?.enrolled
    ? "Ikuti kursus dan mulai"
    : overview.progress.percent === 100
      ? "Buka kembali pelajaran"
      : overview.progress.completedLessons > 0
        ? "Lanjutkan belajar"
        : "Mulai belajar";

  return (
    <div className="course-surface course-detail">
      <Link className="course-back-link" href="/dashboard/kursus">
        <ArrowLeft size={18} aria-hidden="true" />
        Kembali ke katalog
      </Link>

      {loading ? (
        <div className="course-state" role="status">
          <Loader2 className="course-loading-icon" size={30} aria-hidden="true" />
          <h1>Memuat detail kursus</h1>
          <p>Silabus dan progres belajarmu sedang disiapkan.</p>
        </div>
      ) : loadError || !overview ? (
        <div className="course-state" role="alert">
          <Library size={30} aria-hidden="true" />
          <h1>Kursus belum bisa dibuka</h1>
          <p>{loadError || "Data kursus tidak ditemukan."}</p>
          <button type="button" className="course-button course-button-primary" onClick={() => setRetryToken((value) => value + 1)}>
            <RotateCcw size={18} aria-hidden="true" />
            Muat ulang detail
          </button>
        </div>
      ) : (
        <>
          <header className="course-detail-hero">
            <div className="course-detail-intro">
              <div className="course-detail-labels">
                <span className="course-source-label">Beta Development</span>
                <span className="course-source-label">{overview.course.sourceKind === "generated" ? <><Lock size={13} aria-hidden="true" /> Kursus personal · Privat</> : "Kurasi Eureka"}</span>
                <span>{overview.course.category}</span>
                <span>{overview.course.level}</span>
              </div>
              <h1>{overview.course.title}</h1>
              {overview.course.description && <p className="course-detail-description">{overview.course.description}</p>}
              <ul className="course-detail-metadata" aria-label="Ringkasan kursus">
                <li><ListOrdered size={17} aria-hidden="true" />{overview.progress.totalLessons} pelajaran</li>
                <li><Layers size={17} aria-hidden="true" />{overview.course.modules.length} modul</li>
                <li><Clock size={17} aria-hidden="true" />{formatMinutes(overview.course.estimatedMinutes)}</li>
              </ul>
            </div>

            <div className="course-detail-action" aria-label="Progres dan aksi kursus">
              <p className="course-detail-progress-label">{overview.enrolled ? "Progres belajarmu" : "Belum diikuti"}</p>
              <div className="course-detail-progress-value">
                <strong>{overview.progress.percent}%</strong>
                <span>{overview.progress.completedLessons} dari {overview.progress.totalLessons} pelajaran selesai</span>
              </div>
              <progress max={100} value={overview.progress.percent} aria-label={`Progres kursus ${overview.course.title}`}>{overview.progress.percent}%</progress>
              <button
                type="button"
                className="course-button course-button-primary"
                onClick={() => void startCourse()}
                disabled={starting || overview.progress.totalLessons === 0}
              >
                {starting ? <Loader2 className="course-loading-icon" size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
                {starting ? "Menyiapkan ruang belajar…" : overview.progress.totalLessons === 0 ? "Belum ada pelajaran" : actionLabel}
              </button>
              <p className="course-detail-action-hint">
                {overview.progress.totalLessons === 0
                  ? "Silabus ini belum memiliki pelajaran."
                  : "Pelajaran yang belum disusun akan dibuat di ruang belajar saat kamu membukanya."}
              </p>
              <div className="course-detail-action-error" role="alert">{actionError}</div>
            </div>
          </header>

          {creationNotice && (
            <aside className="course-creation-warning" role="status">
              <Info size={19} aria-hidden="true" />
              <p>{creationNotice}</p>
            </aside>
          )}

          {(overview.course.outcome || overview.course.audience || overview.course.prerequisites.length > 0) && (
            <section className="course-learning-summary" aria-label="Tentang hasil belajar">
              {overview.course.outcome && (
                <div>
                  <h2>Yang akan kamu capai</h2>
                  <p>{overview.course.outcome}</p>
                </div>
              )}
              {overview.course.audience && (
                <div>
                  <h2>Untuk siapa kursus ini</h2>
                  <p>{overview.course.audience}</p>
                </div>
              )}
              {overview.course.prerequisites.length > 0 && (
                <div>
                  <h2>Sebelum memulai</h2>
                  <ul>{overview.course.prerequisites.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
                </div>
              )}
            </section>
          )}

          <section className="course-modules-section" aria-labelledby="course-modules-title">
            <div className="course-section-heading">
              <h2 id="course-modules-title">Alur belajar</h2>
              <p>Pelajaran disusun berurutan. Status dan progres mengikuti hasil belajarmu.</p>
            </div>

            {overview.course.modules.length === 0 ? (
              <div className="course-state course-state-inline">
                <BookOpen size={30} aria-hidden="true" />
                <h3>Silabus belum tersedia</h3>
                <p>Kursus ini belum memiliki modul atau pelajaran.</p>
              </div>
            ) : (
              <ol className="course-module-list" role="list">
                {overview.course.modules.map((module, moduleIndex) => {
                  const completedCount = module.lessons.filter(lesson => completedLessonIds.has(lesson.id)).length;
                  const hasCurrent = module.lessons.some(lesson => lesson.id === overview.progress.currentLessonId);
                  const ModuleIcon = [BookOpen, Layers, CheckCircle2][moduleIndex % 3];
                  return (
                  <li key={`${module.id}-${moduleIndex}`}>
                    <details className="course-module" open={hasCurrent || (!overview.progress.currentLessonId && moduleIndex === 0)}>
                      <summary className="course-module-toggle">
                        <span className="course-module-emblem" data-tone={moduleIndex % 3}><ModuleIcon size={23} aria-hidden="true" /></span>
                        <span className="course-module-copy">
                          <small>Modul {moduleIndex + 1} · {completedCount}/{module.lessons.length} selesai</small>
                          <strong>{module.title}</strong>
                        </span>
                        <ArrowRight className="course-module-chevron" size={18} aria-hidden="true" />
                      </summary>
                      {module.description && <p className="course-module-description">{module.description}</p>}
                      {module.lessons.length > 0 ? (
                        <ol className="course-lesson-list" role="list">
                          {module.lessons.map((lesson, lessonIndex) => {
                            const isCompleted = completedLessonIds.has(lesson.id);
                            const display = lessonDisplay(lesson, isCompleted);
                            return (
                              <li className="course-lesson-item" key={`${lesson.id}-${lessonIndex}`}>
                                <span className="course-lesson-number" aria-hidden="true">{lessonIndex + 1}</span>
                                <Link
                                  className="course-lesson-link"
                                  href={lessonPath(overview.course.id, lesson.id)}
                                  aria-label={`${lesson.title}. ${display.label}. ${lesson.minutes} menit. ${display.action}.`}
                                >
                                  <span className="course-lesson-topline">
                                    <span className="course-lesson-title">{lesson.title}</span>
                                    <span className={`course-lesson-status is-${display.tone}`}>
                                      {isCompleted ? <CheckCircle2 size={15} aria-hidden="true" /> : display.tone === "available" ? <BookOpen size={15} aria-hidden="true" /> : <Clock size={15} aria-hidden="true" />}
                                      {display.label}
                                    </span>
                                  </span>
                                  {lesson.summary && <span className="course-lesson-summary">{lesson.summary}</span>}
                                  <span className="course-lesson-footer">
                                    <span><Clock size={15} aria-hidden="true" />{lesson.minutes} menit</span>
                                    <span className="course-lesson-open">{display.action}<ArrowRight size={15} aria-hidden="true" /></span>
                                  </span>
                                </Link>
                              </li>
                            );
                          })}
                        </ol>
                      ) : (
                        <p className="course-module-empty">Belum ada pelajaran dalam modul ini.</p>
                      )}
                    </details>
                  </li>
                ); })}
              </ol>
            )}
          </section>

          {sources.length > 0 && (
            <section className="course-sources" aria-labelledby="course-sources-title">
              <div className="course-section-heading">
                <h2 id="course-sources-title">Sumber untuk verifikasi</h2>
                <p>Bandingkan materi dengan rujukan aslinya. Sumber terbuka di tab baru.</p>
              </div>
              <ul>
                {sources.map((source) => (
                  <li key={`${source.id}-${source.url}`}>
                    <a href={source.url} target="_blank" rel="noreferrer" referrerPolicy="no-referrer">
                      {source.title}
                      <ExternalLink size={15} aria-hidden="true" />
                    </a>
                    {source.note && <p>{source.note}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
