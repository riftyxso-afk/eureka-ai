"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Info,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import type {
  Course,
  CourseLevel,
  CourseLesson,
  CourseModule,
  PersonalCourseInput,
} from "@/lib/courses/types";

type Stage = "details" | "sources" | "review";

const courseSteps = [
  { id: "details", label: "Tujuan", color: "#7540d0", symbol: "★" },
  { id: "sources", label: "Sumber", color: "#167b88", symbol: "▤" },
  { id: "review", label: "Silabus", color: "#b35431", symbol: "✓" },
] as const;

function StepAvatar({ step }: { step: (typeof courseSteps)[number] }) {
  return <svg aria-hidden="true" width="56" height="52" viewBox="0 0 56 52">
    <ellipse cx="25" cy="46" rx="18" ry="3" fill={step.color} opacity=".18" />
    <path d="M24 5c0 9 18 15 18 27a18 14 0 0 1-36 0C6 21 18 16 24 5Z" fill={step.color} />
    <ellipse cx="19" cy="30" rx="3" ry="4" fill="white" /><ellipse cx="30" cy="30" rx="3" ry="4" fill="white" />
    <path d="M22 36q3 4 6 0" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="45" cy="15" r="10" fill="white" stroke={step.color} />
    <text x="45" y="19" textAnchor="middle" fontSize="12" fill={step.color}>{step.symbol}</text>
  </svg>;
}
type BusyAction = "preview" | "create" | null;
type FieldName = "topic" | "goal" | "minutesPerDay" | "title" | "outcome";
type FieldErrors = Partial<Record<FieldName, string>>;

interface PersonalCourseDialogProps {
  open: boolean;
  onClose: () => void;
}

export const COURSE_CREATION_WARNING_KEY = "eureka-course-creation-warning";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function minutes(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(120, Math.max(5, Math.round(parsed))) : 8;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

/** Keep the editable preview in the exact syllabus shape accepted by the API. */
function normalizePreviewCourse(value: unknown): Course | null {
  if (!isRecord(value) || !Array.isArray(value.modules) || value.modules.length !== 2) return null;

  const id = text(value.id);
  const title = text(value.title);
  const outcome = text(value.outcome);
  if (!id || !title || !outcome) return null;

  const modules: CourseModule[] = [];
  for (const moduleValue of value.modules) {
    if (!isRecord(moduleValue) || !Array.isArray(moduleValue.lessons) || moduleValue.lessons.length !== 2) return null;
    const moduleId = text(moduleValue.id);
    const moduleTitle = text(moduleValue.title);
    if (!moduleId || !moduleTitle) return null;

    const lessons: CourseLesson[] = [];
    for (const lessonValue of moduleValue.lessons) {
      if (!isRecord(lessonValue)) return null;
      const lessonId = text(lessonValue.id);
      const lessonTitle = text(lessonValue.title);
      const objectives = stringList(lessonValue.objectives);
      if (!lessonId || !lessonTitle || objectives.length < 2) return null;
      lessons.push({
        id: lessonId,
        title: lessonTitle,
        summary: text(lessonValue.summary),
        minutes: minutes(lessonValue.minutes),
        objectives,
        blocks: [],
        questions: [],
        sources: [],
        status: "pending",
        contentVersion: 1,
      });
    }

    modules.push({
      id: moduleId,
      title: moduleTitle,
      description: text(moduleValue.description),
      lessons,
    });
  }

  const level: CourseLevel = value.level === "Menengah" ? "Menengah" : "Pemula";
  return {
    id,
    slug: text(value.slug, id),
    title,
    category: text(value.category, "Kursus personal"),
    level,
    description: text(value.description),
    outcome,
    audience: text(value.audience),
    prerequisites: stringList(value.prerequisites),
    estimatedMinutes: modules.flatMap((module) => module.lessons).reduce((total, lesson) => total + lesson.minutes, 0),
    version: 1,
    sourceKind: "generated",
    modules,
    sources: [],
  };
}

function createdCourseId(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.overview) || !isRecord(value.overview.course)) return null;
  return text(value.overview.course.id) || null;
}

function payloadError(value: unknown, fallback: string): string {
  return isRecord(value) ? text(value.error, fallback) : fallback;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function PersonalCourseDialog({ open, onClose }: PersonalCourseDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const topicRef = useRef<HTMLInputElement>(null);
  const goalRef = useRef<HTMLTextAreaElement>(null);
  const minutesRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const outcomeRef = useRef<HTMLTextAreaElement>(null);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const creationKeyRef = useRef<string | null>(null);

  const [stage, setStage] = useState<Stage>("details");
  const [links, setLinks] = useState("");
  const [documents, setDocuments] = useState<File[]>([]);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [topic, setTopic] = useState("");
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState<CourseLevel>("Pemula");
  const [minutesPerDay, setMinutesPerDay] = useState("20");
  const [draft, setDraft] = useState<Course | null>(null);
  const [mode, setMode] = useState<"ai" | "starter">("ai");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState("");

  const focusField = useCallback((field: FieldName) => {
    const refs = {
      topic: topicRef,
      goal: goalRef,
      minutesPerDay: minutesRef,
      title: titleRef,
      outcome: outcomeRef,
    };
    window.requestAnimationFrame(() => refs[field].current?.focus());
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    let frame = 0;
    if (open && !dialog.open) {
      creationKeyRef.current = window.crypto.randomUUID();
      setStage("details");
      setLinks("");
      setDocuments([]);
      setTopic("");
      setGoal("");
      setLevel("Pemula");
      setMinutesPerDay("20");
      setDraft(null);
      setErrors({});
      setRequestError("");
      setBusy(null);
      dialog.showModal();
      frame = window.requestAnimationFrame(() => topicRef.current?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
    }

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [open]);

  useEffect(() => {
    if (!open || stage !== "review") return;
    const frame = window.requestAnimationFrame(() => reviewHeadingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, stage]);

  useEffect(() => () => requestRef.current?.abort(), []);

  const requestClose = useCallback(() => {
    // A create may already have persisted on the server; never abandon its response.
    if (busy === "create") return;
    requestRef.current?.abort();
    requestRef.current = null;
    setBusy(null);
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    else onClose();
  }, [busy, onClose]);

  const clearFieldError = (field: FieldName) => {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const validateDetails = (): PersonalCourseInput | null => {
    const nextErrors: FieldErrors = {};
    const cleanTopic = topic.trim();
    const cleanGoal = goal.trim();
    const dailyMinutes = Number(minutesPerDay);

    if (cleanTopic.length < 3) nextErrors.topic = "Tuliskan topik minimal 3 karakter.";
    if (cleanGoal.length < 10) nextErrors.goal = "Jelaskan hasil belajar minimal 10 karakter.";
    if (!Number.isFinite(dailyMinutes) || dailyMinutes < 5 || dailyMinutes > 120) {
      nextErrors.minutesPerDay = "Masukkan waktu antara 5 dan 120 menit.";
    }

    setErrors(nextErrors);
    const firstError = (["topic", "goal", "minutesPerDay"] as FieldName[]).find((field) => nextErrors[field]);
    if (firstError) {
      focusField(firstError);
      return null;
    }

    return {
      topic: cleanTopic,
      goal: cleanGoal,
      level,
      minutesPerDay: Math.round(dailyMinutes),
    };
  };

  const previewCourse = async () => {
    if (busy || requestRef.current) return;
    const input = validateDetails();
    if (!input) return;
    const sourceLinks = [...new Set(links.split(/\r?\n/).map(link => link.trim()).filter(Boolean))];
    if (sourceLinks.length + documents.length > 5 || documents.some(file => !file.size || file.size > 4_000_000)) {
      setRequestError("Tambahkan maksimal 5 sumber, dengan ukuran dokumen hingga 4 MB per file.");
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    setBusy("preview");
    setRequestError("");

    try {
      const form = new FormData();
      form.set("input", JSON.stringify(input));
      sourceLinks.forEach(link => form.append("link", link));
      documents.forEach(file => form.append("document", file));
      const response = await apiFetch("/api/courses", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const payload: unknown = await response.json().catch(() => null);
      if (requestRef.current !== controller || controller.signal.aborted) return;
      if (!response.ok) throw new Error(payloadError(payload, "Silabus belum dapat disusun. Coba lagi."));

      const course = isRecord(payload) ? normalizePreviewCourse(payload.course) : null;
      if (!course) throw new Error("Silabus yang diterima belum lengkap. Coba susun ulang.");

      setDraft(course);
      setMode(isRecord(payload) && payload.mode === "starter" ? "starter" : "ai");
      setStage("review");
    } catch (error) {
      if (requestRef.current === controller && !controller.signal.aborted && !isAbortError(error)) {
        setRequestError(error instanceof Error ? error.message : "Silabus belum dapat disusun. Coba lagi.");
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setBusy(null);
      }
    }
  };

  const validateReview = (): Course | null => {
    if (!draft) return null;
    const nextErrors: FieldErrors = {};
    const title = draft.title.trim();
    const outcome = draft.outcome.trim();
    if (title.length < 3) nextErrors.title = "Tuliskan judul kursus minimal 3 karakter.";
    if (outcome.length < 10) nextErrors.outcome = "Jelaskan tujuan kursus minimal 10 karakter.";
    setErrors(nextErrors);

    const firstError = (["title", "outcome"] as FieldName[]).find((field) => nextErrors[field]);
    if (firstError) {
      focusField(firstError);
      return null;
    }
    return { ...draft, title, outcome };
  };

  const createCourse = async () => {
    if (busy || requestRef.current) return;
    const course = validateReview();
    if (!course) return;

    const controller = new AbortController();
    requestRef.current = controller;
    setBusy("create");
    setRequestError("");

    try {
      const idempotencyKey = creationKeyRef.current ?? window.crypto.randomUUID();
      creationKeyRef.current = idempotencyKey;
      const response = await apiFetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", course, idempotencyKey }),
        signal: controller.signal,
      });
      const payload: unknown = await response.json().catch(() => null);
      if (requestRef.current !== controller || controller.signal.aborted) return;
      if (!response.ok) throw new Error(payloadError(payload, "Kursus belum dapat disimpan. Coba lagi."));

      const courseId = createdCourseId(payload);
      if (!courseId) throw new Error("Kursus tersimpan, tetapi detailnya belum dapat dibuka. Muat ulang katalog.");

      if (isRecord(payload)) {
        const warning = text(payload.warning);
        if (warning) {
          try {
            window.sessionStorage.setItem(COURSE_CREATION_WARNING_KEY, JSON.stringify({ courseId, warning }));
          } catch {
            // The course is still created when browser storage is unavailable.
          }
        }
      }

      requestRef.current = null;
      setBusy(null);
      onClose();
      router.push(`/dashboard/kursus/${encodeURIComponent(courseId)}`);
    } catch (error) {
      if (requestRef.current === controller && !controller.signal.aborted && !isAbortError(error)) {
        setRequestError(error instanceof Error ? error.message : "Kursus belum dapat disimpan. Coba lagi.");
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setBusy(null);
      }
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="personal-course-dialog"
      aria-labelledby="personal-course-title"
      aria-describedby="personal-course-description"
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div className="personal-course-panel">
        <header className="personal-course-header">
          <div>
            <p className="personal-course-step">Langkah {courseSteps.findIndex(step => step.id === stage) + 1} dari 3</p>
            <h2 id="personal-course-title">Buat kursus personal</h2>
            <p id="personal-course-description">
              {stage === "details"
                ? "Ceritakan tujuanmu. Eureka akan menyusun jalur belajar yang bisa kamu tinjau."
                : stage === "sources" ? "Gabungkan tautan dan dokumen dalam satu kursus, atau lanjutkan tanpa sumber."
                : "Periksa judul, tujuan, dan urutan pelajaran sebelum kursus disimpan."}
            </p>
          </div>
          <button type="button" className="personal-course-close" onClick={requestClose} aria-label="Tutup pembuat kursus personal" disabled={busy === "create"}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <ol className="personal-course-stepper" aria-label="Tahap pembuatan kursus">
          {courseSteps.map(step => <li key={step.id} aria-current={step.id === stage ? "step" : undefined}><StepAvatar step={step} /><span>{step.label}</span></li>)}
        </ol>

        <form
          className="personal-course-form"
          noValidate
          aria-busy={busy !== null}
          onSubmit={(event) => {
            event.preventDefault();
            if (stage === "details") {
              if (validateDetails()) { setRequestError(""); setStage("sources"); }
            }
            else if (stage === "sources") void previewCourse();
            else void createCourse();
          }}
        >
          {stage === "details" ? (
            <>
              <div className="course-field">
                <label htmlFor="personal-course-topic">Topik yang ingin dipelajari</label>
                <input
                  ref={topicRef}
                  id="personal-course-topic"
                  name="topic"
                  type="text"
                  value={topic}
                  maxLength={100}
                  autoComplete="off"
                  placeholder="Contoh: membaca data penjualan"
                  aria-invalid={Boolean(errors.topic)}
                  aria-describedby={errors.topic ? "personal-course-topic-error" : undefined}
                  onChange={(event) => {
                    setTopic(event.target.value);
                    clearFieldError("topic");
                  }}
                />
                {errors.topic && <p className="course-field-error" id="personal-course-topic-error">{errors.topic}</p>}
              </div>

              <div className="course-field">
                <label htmlFor="personal-course-goal">Hasil yang ingin kamu capai</label>
                <textarea
                  ref={goalRef}
                  id="personal-course-goal"
                  name="goal"
                  value={goal}
                  maxLength={400}
                  rows={4}
                  placeholder="Contoh: membuat rekap penjualan mingguan tanpa menghitung manual"
                  aria-invalid={Boolean(errors.goal)}
                  aria-describedby={errors.goal ? "personal-course-goal-error" : undefined}
                  onChange={(event) => {
                    setGoal(event.target.value);
                    clearFieldError("goal");
                  }}
                />
                {errors.goal && <p className="course-field-error" id="personal-course-goal-error">{errors.goal}</p>}
              </div>

              <div className="personal-course-form-grid">
                <div className="course-field">
                  <label htmlFor="personal-course-level">Tingkat pengalaman</label>
                  <select
                    id="personal-course-level"
                    name="level"
                    value={level}
                    onChange={(event) => setLevel(event.target.value === "Menengah" ? "Menengah" : "Pemula")}
                  >
                    <option value="Pemula">Pemula</option>
                    <option value="Menengah">Menengah</option>
                  </select>
                </div>
                <div className="course-field">
                  <label htmlFor="personal-course-minutes">Waktu belajar per hari</label>
                  <div className="personal-course-minutes">
                    <input
                      ref={minutesRef}
                      id="personal-course-minutes"
                      name="minutesPerDay"
                      type="number"
                      min={5}
                      max={120}
                      step={5}
                      inputMode="numeric"
                      value={minutesPerDay}
                      aria-invalid={Boolean(errors.minutesPerDay)}
                      aria-describedby={`personal-course-minutes-hint${errors.minutesPerDay ? " personal-course-minutes-error" : ""}`}
                      onChange={(event) => {
                        setMinutesPerDay(event.target.value);
                        clearFieldError("minutesPerDay");
                      }}
                    />
                    <span aria-hidden="true">menit</span>
                  </div>
                  <p className="course-field-hint" id="personal-course-minutes-hint">Antara 5 dan 120 menit.</p>
                  {errors.minutesPerDay && <p className="course-field-error" id="personal-course-minutes-error">{errors.minutesPerDay}</p>}
                </div>
              </div>
            </>
          ) : stage === "sources" ? (
            <div className="personal-course-sources">
              <div className="course-field">
                <label htmlFor="course-source-links">Tautan YouTube atau web</label>
                <textarea id="course-source-links" rows={3} maxLength={4000} disabled={busy !== null} value={links} onChange={event => setLinks(event.target.value)} placeholder="Tempel satu tautan per baris" />
              </div>
              <div className="course-field">
                <label htmlFor="course-source-files">Tambah dokumen</label>
                <input id="course-source-files" type="file" multiple accept=".pdf,.docx,.pptx,.txt" disabled={busy !== null} onChange={event => {
                  const files = Array.from(event.currentTarget.files ?? []);
                  setDocuments(current => [...current, ...files].slice(0, 5));
                  event.currentTarget.value = "";
                }} />
                <p className="course-field-hint">Maksimal 5 sumber gabungan. PDF, DOCX, PPTX, TXT hingga 4 MB per file.</p>
                <ul className="personal-source-files">{documents.map((file, index) => <li key={`${file.name}-${index}`}><span>{file.name}</span><button type="button" className="course-button course-button-secondary" disabled={busy !== null} onClick={() => setDocuments(current => current.filter((_, i) => i !== index))}>Hapus <span className="sr-only">{file.name}</span></button></li>)}</ul>
              </div>
            </div>
          ) : draft ? (
            <>
              <button
                type="button"
                className="course-back-link personal-course-back"
                onClick={() => {
                  setStage("sources");
                  setErrors({});
                  setRequestError("");
                }}
                disabled={busy !== null}
              >
                <ArrowLeft size={17} aria-hidden="true" />
                Ubah sumber belajar
              </button>

              <div className={`personal-course-preview-note ${mode === "starter" ? "is-starter" : ""}`}>
                <Info size={19} aria-hidden="true" />
                <p>
                  {mode === "starter"
                    ? "AI belum tersedia, jadi ini silabus awal. Kamu tetap dapat meninjau dan menyimpannya."
                    : "Silabus ini disusun oleh AI. Tinjau kembali sebelum digunakan untuk belajar."}{" "}
                  Materi lengkap dan latihan disusun saat pelajaran dibuka.
                </p>
              </div>

              <div className="course-field">
                <label htmlFor="personal-course-review-title">Judul kursus</label>
                <input
                  ref={titleRef}
                  id="personal-course-review-title"
                  name="title"
                  type="text"
                  value={draft.title}
                  maxLength={120}
                  autoComplete="off"
                  aria-invalid={Boolean(errors.title)}
                  aria-describedby={errors.title ? "personal-course-review-title-error" : undefined}
                  onChange={(event) => {
                    setDraft((current) => current ? { ...current, title: event.target.value } : current);
                    clearFieldError("title");
                  }}
                />
                {errors.title && <p className="course-field-error" id="personal-course-review-title-error">{errors.title}</p>}
              </div>

              <div className="course-field">
                <label htmlFor="personal-course-review-outcome">Tujuan kursus</label>
                <textarea
                  ref={outcomeRef}
                  id="personal-course-review-outcome"
                  name="outcome"
                  value={draft.outcome}
                  maxLength={400}
                  rows={3}
                  aria-invalid={Boolean(errors.outcome)}
                  aria-describedby={errors.outcome ? "personal-course-review-outcome-error" : undefined}
                  onChange={(event) => {
                    setDraft((current) => current ? { ...current, outcome: event.target.value } : current);
                    clearFieldError("outcome");
                  }}
                />
                {errors.outcome && <p className="course-field-error" id="personal-course-review-outcome-error">{errors.outcome}</p>}
              </div>

              <h3 ref={reviewHeadingRef} className="personal-course-review-heading" tabIndex={-1}>Silabus yang akan disimpan</h3>
              <ol className="personal-course-preview-modules" role="list">
                {draft.modules.map((module, moduleIndex) => (
                  <li key={module.id}>
                    <p className="personal-course-module-label">Modul {moduleIndex + 1}</p>
                    <h4>{module.title}</h4>
                    {module.description && <p className="personal-course-module-description">{module.description}</p>}
                    <ol className="personal-course-preview-lessons" role="list">
                      {module.lessons.map((lesson, lessonIndex) => (
                        <li key={lesson.id}>
                          <div>
                            <p>{lessonIndex + 1}. {lesson.title}</p>
                            {lesson.summary && <span>{lesson.summary}</span>}
                          </div>
                          <span className="personal-course-lesson-time">
                            <Clock size={15} aria-hidden="true" />
                            {lesson.minutes} menit
                          </span>
                        </li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ol>
            </>
          ) : null}

          <div className="course-form-request-error" role="alert">{requestError}</div>
          <p className="course-visually-hidden" role="status">
            {busy === "preview" ? "Sedang menyusun silabus." : busy === "create" ? "Sedang menyimpan kursus." : ""}
          </p>
          {busy === "create" && (
            <p className="personal-course-create-pending" role="status">
              Kursus sedang disimpan. Tunggu hingga halaman detail terbuka.
            </p>
          )}

          <footer className={`personal-course-actions ${stage === "details" ? "is-details" : ""}`}>
            {stage === "sources" && <button type="button" className="course-button course-button-secondary" disabled={busy !== null} onClick={() => { setStage("details"); setRequestError(""); }}>Kembali ke tujuan</button>}
            {stage === "review" && (
              <button type="button" className="course-button course-button-secondary" onClick={requestClose} disabled={busy !== null}>
                Batal
              </button>
            )}
            <button type="submit" className="course-button course-button-primary" disabled={busy !== null || (stage === "review" && !draft)}>
              {busy ? <Loader2 className="course-loading-icon" size={18} aria-hidden="true" /> : stage === "details" ? <BookOpen size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
              {busy === "preview" ? "Membaca sumber dan menyusun silabus…" : busy === "create" ? "Menyimpan kursus…" : stage === "details" ? "Lanjut ke sumber" : stage === "sources" ? "Susun silabus" : "Simpan kursus"}
            </button>
          </footer>
        </form>
      </div>
    </dialog>
  );
}

export default PersonalCourseDialog;
