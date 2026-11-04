"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  BookOpen,
  Clock,
  Info,
  Library,
  ListOrdered,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";
import PersonalCourseDialog from "@/components/courses/PersonalCourseDialog";
import { apiFetch } from "@/lib/apiClient";
import type { CourseProgress, CourseSummary } from "@/lib/courses/types";
import "./kursus.css";

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

function normalizeProgress(value: unknown): CourseProgress | null {
  if (!isRecord(value)) return null;
  const totalLessons = wholeNumber(value.totalLessons);
  const completedLessons = Math.min(wholeNumber(value.completedLessons), totalLessons);
  return {
    completedLessons,
    totalLessons,
    percent: totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0,
    currentLessonId: text(value.currentLessonId) || null,
  };
}

function normalizeCourseSummary(value: unknown): CourseSummary | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  const title = text(value.title);
  if (!id || !title) return null;
  const progress = normalizeProgress(value.progress);

  return {
    id,
    slug: text(value.slug, id),
    title,
    category: text(value.category, "Umum"),
    level: value.level === "Menengah" ? "Menengah" : "Pemula",
    description: text(value.description),
    outcome: text(value.outcome),
    estimatedMinutes: wholeNumber(value.estimatedMinutes),
    lessonCount: wholeNumber(value.lessonCount, progress?.totalLessons ?? 0),
    moduleCount: wholeNumber(value.moduleCount),
    sourceKind: value.sourceKind === "generated" ? "generated" : "curated",
    progress,
  };
}

function coursePath(course: CourseSummary): string {
  return `/dashboard/kursus/${encodeURIComponent(course.slug || course.id)}`;
}

function lessonPath(course: CourseSummary): string {
  const lessonId = course.progress?.currentLessonId;
  return lessonId
    ? `/dashboard/kursus/${encodeURIComponent(course.id)}/pelajaran/${encodeURIComponent(lessonId)}`
    : coursePath(course);
}

function formatMinutes(value: number): string {
  const total = wholeNumber(value);
  if (total < 60) return `${total} menit`;
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  return remainder ? `${hours} jam ${remainder} menit` : `${hours} jam`;
}

function CourseProgressBar({ course }: { course: CourseSummary }) {
  if (!course.progress) return <p className="course-card-not-started">Belum diikuti</p>;
  const { percent, completedLessons, totalLessons } = course.progress;
  return (
    <div className="course-card-progress">
      <div>
        <span>{percent}% selesai</span>
        <span>{completedLessons} dari {totalLessons} pelajaran</span>
      </div>
      <progress max={100} value={percent} aria-label={`Progres kursus ${course.title}`}>{percent}%</progress>
    </div>
  );
}

const courseViews = [
  { id: "all", label: "Semua" },
  { id: "active", label: "Sedang belajar" },
  { id: "completed", label: "Selesai" },
  { id: "personal", label: "Personal" },
] as const;

type CourseView = (typeof courseViews)[number]["id"];

function matchesView(course: CourseSummary, view: CourseView): boolean {
  if (view === "active") return course.progress !== null && course.progress.percent < 100;
  if (view === "completed") return course.progress?.percent === 100;
  if (view === "personal") return course.sourceKind === "generated";
  return true;
}

export default function CourseCatalogPage() {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [storage, setStorage] = useState<"supabase" | "local" | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [view, setView] = useState<CourseView>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Kursus | Eureka";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCatalog() {
      setLoading(true);
      setLoadError("");
      try {
        const response = await apiFetch("/api/courses", { signal: controller.signal });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message = isRecord(payload) ? text(payload.error, "Katalog kursus belum dapat dimuat.") : "Katalog kursus belum dapat dimuat.";
          throw new Error(message);
        }
        if (!isRecord(payload) || !Array.isArray(payload.courses)) {
          throw new Error("Data katalog belum dapat dibaca. Coba muat ulang.");
        }

        const nextCourses = payload.courses
          .map(normalizeCourseSummary)
          .filter((course): course is CourseSummary => course !== null);
        if (controller.signal.aborted) return;
        setCourses(nextCourses);
        setStorage(payload.storage === "local" ? "local" : payload.storage === "supabase" ? "supabase" : null);
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : "Katalog kursus belum dapat dimuat.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadCatalog();
    return () => controller.abort();
  }, [retryToken]);

  const categories = useMemo(
    () => Array.from(new Set(courses.map((course) => course.category))).sort((a, b) => a.localeCompare(b, "id")),
    [courses],
  );

  const filteredCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("id");
    return courses.filter((course) => {
      if (!matchesView(course, view)) return false;
      if (category !== "all" && course.category !== category) return false;
      if (!normalizedQuery) return true;
      return [course.title, course.description, course.outcome, course.category]
        .join(" ")
        .toLocaleLowerCase("id")
        .includes(normalizedQuery);
    });
  }, [courses, category, query, view]);

  const continueCourses = useMemo(
    () => courses.filter((course) => course.progress && course.progress.percent < 100 && (course.progress.currentLessonId || course.progress.completedLessons > 0)),
    [courses],
  );

  const resetFilters = () => {
    setQuery("");
    setCategory("all");
    setView("all");
  };

  return (
    <div className="course-surface course-catalog">
      <header className="course-heading">
        <div>
          <span className="course-catalog-kicker"><Library size={16} aria-hidden="true" /> Ruang belajar · Beta Development</span>
          <h1>Kursus</h1>
          <p>Pilih topik baru atau lanjutkan pelajaran dari progres terakhirmu.</p>
        </div>
        <button type="button" className="course-button course-button-primary" onClick={() => setDialogOpen(true)}>
          <Plus size={19} aria-hidden="true" />
          Buat kursus personal
        </button>
      </header>

      {storage === "local" && !loading && !loadError && (
        <aside className="course-local-note" aria-label="Catatan penyimpanan lokal">
          <Info size={19} aria-hidden="true" />
          <p>Kursus dan progres disimpan di lingkungan lokal ini.</p>
        </aside>
      )}

      {loading ? (
        <div className="course-state" role="status">
          <Loader2 className="course-loading-icon" size={30} aria-hidden="true" />
          <h2>Menyiapkan katalog kursus</h2>
          <p>Daftar kursus dan progres belajarmu sedang dimuat.</p>
        </div>
      ) : loadError ? (
        <div className="course-state" role="alert">
          <Library size={30} aria-hidden="true" />
          <h2>Katalog belum bisa dibuka</h2>
          <p>{loadError}</p>
          <button type="button" className="course-button course-button-primary" onClick={() => setRetryToken((value) => value + 1)}>
            <RotateCcw size={18} aria-hidden="true" />
            Muat ulang katalog
          </button>
        </div>
      ) : (
        <>
          {continueCourses.length > 0 && (
            <section className="course-continue" aria-labelledby="course-continue-title">
              <div className="course-section-heading">
                <h2 id="course-continue-title">Lanjutkan belajar</h2>
                <p>Kembali ke pelajaran terakhir tanpa kehilangan progres.</p>
              </div>
              <div className="course-continue-list">
                {continueCourses.slice(0, 1).map((course) => {
                  const progress = course.progress;
                  if (!progress) return null;
                  return (
                    <article className="course-continue-item" key={course.id}>
                      <div className="course-continue-copy">
                        <p><BookOpenCheck size={15} aria-hidden="true" /> {course.category}</p>
                        <h3>{course.title}</h3>
                      </div>
                      <div className="course-continue-progress">
                        <div>
                          <span>{progress.percent}% selesai</span>
                          <span>{progress.completedLessons} dari {progress.totalLessons} pelajaran</span>
                        </div>
                        <progress max={100} value={progress.percent} aria-label={`Progres kursus ${course.title}`}>{progress.percent}%</progress>
                      </div>
                      <Link className="course-button course-button-secondary" href={lessonPath(course)} aria-label={`${progress.completedLessons ? "Lanjutkan" : "Mulai"} kursus ${course.title}`}>
                        {progress.completedLessons ? "Lanjutkan" : "Mulai"}
                        <ArrowRight size={17} aria-hidden="true" />
                      </Link>
                    </article>
                  );
                })}
              </div>
              {continueCourses.length > 1 && (
                <a className="course-more-active" href="#course-catalog-title" onClick={() => { setQuery(""); setCategory("all"); setView("active"); }}>
                  Lihat semua kursus yang sedang diikuti <ArrowRight size={15} aria-hidden="true" />
                </a>
              )}
            </section>
          )}

          <section className="course-catalog-section" aria-labelledby="course-catalog-title">
            <div className="course-section-heading">
              <h2 id="course-catalog-title" tabIndex={-1}>Jelajahi kursus</h2>
              <p>Pilih jalur yang sesuai dengan tujuan belajarmu.</p>
            </div>

            <div className="course-catalog-filters">
              <div className="course-view-filters" role="group" aria-label="Status kursus">
                {courseViews.map(({ id, label }) => (
                  <button type="button" key={id} aria-pressed={view === id} onClick={() => setView(id)}>
                    {label}<span aria-hidden="true">{courses.filter(course => matchesView(course, id)).length}</span>
                  </button>
                ))}
              </div>
              <form className="course-toolbar" role="search" onSubmit={(event) => event.preventDefault()}>
              <div className="course-toolbar-field">
                <label htmlFor="course-search">Cari kursus</label>
                <div className="course-search-input">
                  <Search size={18} aria-hidden="true" />
                  <input
                    id="course-search"
                    name="query"
                    type="search"
                    value={query}
                    autoComplete="off"
                    placeholder="Cari judul, topik, atau tujuan"
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
              </div>
              <div className="course-toolbar-field">
                <label htmlFor="course-category">Filter kategori</label>
                <select id="course-category" name="category" value={category} onChange={(event) => setCategory(event.target.value)}>
                  <option value="all">Semua kategori</option>
                  {categories.map((item) => <option value={item} key={item}>{item}</option>)}
                </select>
              </div>
              </form>
            </div>

            <p className="course-result-count" role="status">
              Menampilkan {filteredCourses.length} dari {courses.length} kursus
            </p>

            {courses.length === 0 ? (
              <div className="course-state course-state-inline">
                <BookOpen size={30} aria-hidden="true" />
                <h2>Belum ada kursus di katalog</h2>
                <p>Susun jalur belajar dari topik dan tujuanmu sendiri.</p>
                <button type="button" className="course-button course-button-primary" onClick={() => setDialogOpen(true)}>
                  <Plus size={18} aria-hidden="true" />
                  Buat kursus personal
                </button>
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="course-state course-state-inline">
                <Search size={30} aria-hidden="true" />
                <h2>Tidak ada kursus yang cocok</h2>
                <p>Coba kata kunci lain atau reset filter untuk melihat seluruh katalog.</p>
                <button type="button" className="course-button course-button-secondary" onClick={resetFilters}>
                  <RotateCcw size={18} aria-hidden="true" />
                  Hapus pencarian dan filter
                </button>
              </div>
            ) : (
              <div className="course-grid">
                {filteredCourses.map((course) => (
                  <article className="course-catalog-item" key={course.id}>
                    <Link className="course-card" href={coursePath(course)}>
                      <div className="course-card-cover" data-personal={course.sourceKind === "generated" || undefined}>
                        <span>{course.category}</span>
                        {course.sourceKind === "generated" ? <Sparkles size={26} aria-hidden="true" /> : <BookOpen size={26} aria-hidden="true" />}
                      </div>
                      <div className="course-card-labels">
                        <span className="course-source-label">{course.sourceKind === "generated" ? "Kursus personal" : "Kurasi Eureka"}</span>
                        <span>{course.level}</span>
                      </div>
                      <h3>{course.title}</h3>
                      {course.description && <p className="course-card-description">{course.description}</p>}
                      <ul className="course-card-metadata" aria-label="Ringkasan kursus">
                        <li><ListOrdered size={16} aria-hidden="true" />{course.lessonCount} pelajaran</li>
                        <li><Clock size={16} aria-hidden="true" />{formatMinutes(course.estimatedMinutes)}</li>
                      </ul>
                      <CourseProgressBar course={course} />
                      <span className="course-card-open">Lihat silabus<ArrowRight size={16} aria-hidden="true" /></span>
                    </Link>
                    {matchesView(course, "active") && course.progress?.currentLessonId && (
                      <Link className="course-card-resume" href={lessonPath(course)} aria-label={`Lanjutkan kursus ${course.title}`}>
                        Lanjutkan pelajaran <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <PersonalCourseDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
