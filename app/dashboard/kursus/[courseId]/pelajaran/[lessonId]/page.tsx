"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Circle, Clock3, ExternalLink, FileText, LoaderCircle, LockKeyhole, RefreshCw, Sparkles, Target, Trophy } from "lucide-react";
import { LessonTutor } from "@/components/courses/LessonTutor";
import { apiFetch } from "@/lib/apiClient";
import type { AttemptResult, CourseLesson, CourseOverview, LearnerQuestion, LessonBlock } from "@/lib/courses/types";
import "./learning-room.css";

type LearnerLesson = Omit<CourseLesson, "questions"> & { questions: LearnerQuestion[] };
type LessonPayload = { lesson: LearnerLesson; course: { id: string; title: string; sourceKind: "curated" | "generated" } };

function LessonBlockView({ block }: { block: LessonBlock }) {
  if (block.type === "bullets") return <div className="lesson-block">{block.title && <h2>{block.title}</h2>}<ul>{block.items.map((item) => <li key={item}>{item}</li>)}</ul></div>;
  if (block.type === "paragraph") return <div className="lesson-block"><p>{block.text}</p></div>;
  return <div className={`lesson-block is-${block.type}`}><h2>{block.title}</h2><p>{block.text}</p></div>;
}

export default function LearningRoomPage() {
  const params = useParams<{ courseId: string; lessonId: string }>();
  const courseId = String(params.courseId ?? "");
  const lessonId = String(params.lessonId ?? "");
  const [overview, setOverview] = useState<CourseOverview | null>(null);
  const [payload, setPayload] = useState<LessonPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [attempt, setAttempt] = useState<AttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const attemptKey = useRef("");
  const contentHeading = useRef<HTMLHeadingElement>(null);
  const loadController = useRef<AbortController | null>(null);
  const submitController = useRef<AbortController | null>(null);

  const loadLesson = useCallback(async (allowGeneration: boolean, signal: AbortSignal) => {
    const response = await apiFetch(`/api/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`, { signal });
    const data = await response.json().catch(() => null);
    if (signal.aborted) return;
    if (response.status === 409 && data?.pending && allowGeneration) {
      setGenerating(true);
      const generated = await apiFetch(`/api/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate" }), signal,
      });
      const generatedData = await generated.json().catch(() => null);
      if (signal.aborted) return;
      if (!generated.ok) throw new Error(generatedData?.error || "Pelajaran belum dapat disusun.");
      setPayload(generatedData as LessonPayload);
      return;
    }
    if (!response.ok) throw new Error(data?.error || "Pelajaran belum dapat dimuat.");
    setPayload(data as LessonPayload);
  }, [courseId, lessonId]);

  const load = useCallback(async () => {
    loadController.current?.abort();
    submitController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    const isStale = () => controller.signal.aborted || loadController.current !== controller;
    setLoading(true); setGenerating(false); setSubmitting(false); setError(""); setOverview(null); setPayload(null); setAttempt(null); setAnswers({});
    attemptKey.current = "";
    try {
      let response = await apiFetch(`/api/courses/${encodeURIComponent(courseId)}`, { signal: controller.signal });
      let data = await response.json().catch(() => null);
      if (isStale()) return;
      if (!response.ok) throw new Error(data?.error || "Kursus tidak ditemukan.");
      let nextOverview = data?.overview as CourseOverview;
      if (!nextOverview.enrolled) {
        response = await apiFetch(`/api/courses/${encodeURIComponent(courseId)}`, { method: "POST", signal: controller.signal });
        data = await response.json().catch(() => null);
        if (isStale()) return;
        if (!response.ok) throw new Error(data?.error || "Kursus belum dapat dimulai.");
        nextOverview = data.overview as CourseOverview;
      }
      setOverview(nextOverview);
      await loadLesson(nextOverview.course.sourceKind === "generated", controller.signal);
    } catch (reason) {
      if (!isStale()) setError(reason instanceof Error ? reason.message : "Pelajaran belum dapat dimuat.");
    } finally {
      if (!isStale()) {
        setLoading(false); setGenerating(false);
      }
    }
  }, [courseId, loadLesson]);

  useEffect(() => {
    void load();
    return () => {
      loadController.current?.abort();
      submitController.current?.abort();
    };
  }, [load]);

  const flatLessons = useMemo(() => overview?.course.modules.flatMap((module) => module.lessons) ?? [], [overview]);
  const currentIndex = flatLessons.findIndex((lesson) => lesson.id === lessonId);
  const nextLesson = currentIndex >= 0 ? flatLessons.slice(currentIndex + 1).find((lesson) => overview?.course.sourceKind === "generated" || lesson.status !== "pending") : undefined;
  const progressMap = useMemo(() => new Map(overview?.lessons.map((item) => [item.lessonId, item]) ?? []), [overview]);
  const completedCount = overview?.progress.completedLessons ?? 0;
  const allAnswered = Boolean(payload?.lesson.questions.length) && payload!.lesson.questions.every((question) => Number.isInteger(answers[question.id]));

  function changeAnswer(questionId: string, answer: number) {
    submitController.current?.abort();
    setSubmitting(false);
    setAnswers((current) => ({ ...current, [questionId]: answer }));
    setAttempt(null);
    attemptKey.current = "";
  }

  async function submitAnswers() {
    if (!allAnswered || submitting || !payload) return;
    submitController.current?.abort();
    const controller = new AbortController();
    submitController.current = controller;
    const isStale = () => controller.signal.aborted || submitController.current !== controller;
    setSubmitting(true); setError("");
    if (!attemptKey.current) attemptKey.current = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `attempt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const response = await apiFetch(`/api/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ action: "attempt", answers, idempotencyKey: attemptKey.current }),
      });
      const data = await response.json().catch(() => null);
      if (isStale()) return;
      if (!response.ok) throw new Error(data?.error || "Jawaban belum dapat dinilai.");
      setAttempt(data.attempt as AttemptResult);
      const refreshed = await apiFetch(`/api/courses/${encodeURIComponent(courseId)}`, { signal: controller.signal });
      const refreshedData = await refreshed.json().catch(() => null);
      if (isStale()) return;
      if (refreshed.ok) setOverview(refreshedData.overview as CourseOverview);
      window.setTimeout(() => {
        if (!isStale()) document.getElementById("hasil-latihan")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 60);
    } catch (reason) {
      if (!isStale()) setError(reason instanceof Error ? reason.message : "Jawaban belum dapat dinilai.");
    } finally {
      if (!isStale()) setSubmitting(false);
    }
  }

  const staleRoute = Boolean((overview && overview.course.id !== courseId) || (payload && (payload.course.id !== courseId || payload.lesson.id !== lessonId)));
  if (loading || staleRoute) return <div className="learning-room"><div className="learning-loading" role="status"><LoaderCircle className="spin" size={22} />{generating && !staleRoute ? "Momo sedang menyusun pelajaran ini…" : "Menyiapkan ruang belajarmu…"}</div></div>;
  if (!overview || !payload) return <div className="learning-room"><div className="learning-state" role="alert"><BookOpen size={30} /><h1>Pelajaran belum bisa dibuka</h1><p>{error || "Materi tidak ditemukan."}</p><button className="learning-button learning-button-primary" type="button" onClick={() => void load()}><RefreshCw size={17} />Coba lagi</button><Link className="learning-button learning-button-secondary" href={`/dashboard/kursus/${courseId}`}>Kembali ke silabus</Link></div></div>;

  const lesson = payload.lesson;
  const completed = progressMap.get(lessonId)?.status === "completed" || attempt?.passed;
  return (
    <div className="learning-room">
      <div className="learning-topbar"><Link className="learning-back" href={`/dashboard/kursus/${courseId}`}><ArrowLeft size={17} />Kembali ke silabus</Link><div className="learning-topbar-meta"><span>{completedCount}/{flatLessons.length} pelajaran selesai</span><a href="#tutor-momo">Tanya Momo</a></div></div>
      <div className="learning-layout">
        <aside className="learning-syllabus" aria-label="Daftar pelajaran">
          <p className="learning-course-label">{overview.course.sourceKind === "generated" ? "Kursus personal · Privat" : "Kursus gratis"}</p><h2 className="learning-course-title">{overview.course.title}</h2>
          <div className="learning-progress-track" role="progressbar" aria-label="Progres kursus" aria-valuemin={0} aria-valuemax={100} aria-valuenow={overview.progress.percent}><span style={{ width: `${overview.progress.percent}%` }} /></div>
          <div className="learning-progress-copy"><span>{overview.progress.percent}% selesai</span><span>{completedCount}/{flatLessons.length}</span></div>
          <div className="learning-modules">{overview.course.modules.map((module, moduleIndex) => <section className="learning-module" key={module.id}><h2>Modul {moduleIndex + 1} · {module.title}</h2><ol>{module.lessons.map((item) => { const done = progressMap.get(item.id)?.status === "completed"; return <li key={item.id}><Link className={`learning-lesson-link ${item.id === lessonId ? "is-current" : ""} ${done ? "is-complete" : ""}`} href={`/dashboard/kursus/${courseId}/pelajaran/${item.id}`} aria-current={item.id === lessonId ? "page" : undefined}>{done ? <CheckCircle2 size={16} /> : item.status === "pending" ? <Sparkles size={16} /> : <Circle size={16} />}<span>{item.title}</span></Link></li>; })}</ol></section>)}</div>
        </aside>
        <main className="lesson-paper">
          <header className="lesson-header"><div className="lesson-kicker"><BookOpen size={16} />Pelajaran {currentIndex + 1} dari {flatLessons.length}</div><h1 ref={contentHeading} tabIndex={-1}>{lesson.title}</h1><p className="lesson-summary">{lesson.summary}</p><div className="lesson-meta"><span><Clock3 size={15} />{lesson.minutes} menit</span><span><FileText size={15} />{lesson.questions.length} latihan</span>{payload.course.sourceKind === "generated" && <span><LockKeyhole size={15} />Materi AI · Privat</span>}</div></header>
          <article className="lesson-content">
            {lesson.objectives.length > 0 && <section className="lesson-objectives"><h2>Setelah pelajaran ini, kamu bisa:</h2><ul>{lesson.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul></section>}
            {lesson.blocks.map((block, index) => <LessonBlockView block={block} key={`${block.type}-${index}`} />)}
          </article>
          {lesson.sources.length > 0 && <section className="lesson-sources"><h2><ExternalLink size={16} />Rujukan materi</h2><ul>{lesson.sources.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>{source.note && <p>{source.note}</p>}</li>)}</ul></section>}
          <section className="lesson-exercise" aria-labelledby="exercise-title"><div className="lesson-exercise-heading"><div><h2 id="exercise-title">Cek pemahamanmu</h2><p>Jawab dari materi di atas. Pembahasan muncul setelah kamu mengirim jawaban.</p></div><span className="lesson-pass-mark">Lulus dengan nilai ≥ 70</span></div>
            {lesson.questions.map((question, questionIndex) => { const result = attempt?.results.find((item) => item.questionId === question.id); return <fieldset className="lesson-question" key={question.id}><legend>{questionIndex + 1}. {question.prompt}</legend><div className="lesson-options">{question.options.map((option, optionIndex) => { const selected = answers[question.id] === optionIndex; const resultClass = result ? optionIndex === result.correctAnswer ? "is-correct" : selected && !result.isCorrect ? "is-wrong" : "" : ""; return <label className={`lesson-option ${resultClass}`} key={option}><input type="radio" name={question.id} value={optionIndex} checked={selected} onChange={() => changeAnswer(question.id, optionIndex)} /> <span>{option}</span></label>; })}</div>{result && <div className="lesson-explanation" role="note"><strong>{result.isCorrect ? "Tepat!" : `Jawaban yang tepat: ${question.options[result.correctAnswer]}`}</strong><br />{result.explanation}</div>}</fieldset>; })}
            {error && <div className="lesson-tutor-error" role="alert">{error}</div>}
            <div className="lesson-submit-row"><button className="learning-button learning-button-primary" type="button" disabled={!allAnswered || submitting} onClick={() => void submitAnswers()}>{submitting ? <LoaderCircle size={18} className="spin" /> : <Target size={18} />}{submitting ? "Menilai jawaban…" : attempt ? "Kirim jawaban baru" : "Periksa jawabanku"}</button><span className="lesson-submit-hint">{allAnswered ? "Jawaban dinilai aman di server." : "Jawab semua soal untuk melanjutkan."}</span></div>
            {attempt && <div className={`lesson-result ${attempt.passed ? "is-passed" : "is-retry"}`} id="hasil-latihan" role="status" tabIndex={-1}><h3>{attempt.passed ? `Pelajaran selesai · ${attempt.score}` : `Nilaimu ${attempt.score} · Ayo coba lagi`}</h3><p>{attempt.storage === "local" ? "Progres tersimpan di mode lokal. XP akun diberikan setelah penyimpanan Supabase aktif." : attempt.passed ? `${attempt.correctAnswers} dari ${attempt.totalQuestions} jawaban benar.${attempt.xpAwarded > 0 ? ` Kamu mendapat ${attempt.xpAwarded} XP untuk penyelesaian pertama.` : " Progres terbaikmu tetap tersimpan."}` : "Baca pembahasan di tiap soal, ubah jawabanmu, lalu kirim kembali. Tidak ada batas percobaan."}</p>{attempt.passed && nextLesson && <Link className="learning-button learning-button-primary" href={`/dashboard/kursus/${courseId}/pelajaran/${nextLesson.id}`}>Pelajaran berikutnya<ArrowRight size={17} /></Link>}{attempt.passed && !nextLesson && <Link className="learning-button learning-button-primary" href={`/dashboard/kursus/${courseId}`}><Trophy size={17} />Lihat hasil kursus</Link>}</div>}
          </section>
          {completed && !nextLesson && <section className="lesson-complete"><h2>Kamu mencapai akhir materi yang tersedia.</h2><p>Tinjau kembali pelajaran yang masih belum selesai dari daftar di samping. Progres hanya bertambah dari latihan yang benar-benar kamu kerjakan.</p></section>}
        </main>
        <LessonTutor key={`${courseId}:${lessonId}`} courseId={courseId} lessonId={lessonId} lessonTitle={lesson.title} />
      </div>
    </div>
  );
}
