"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, GraduationCap, Lock, Pencil, Target, Trophy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import V2FeaturePage from "@/components/dashboard/V2FeaturePage";
import { useDashboardNotes } from "@/components/dashboard/useDashboardNotes";
import MarkdownView from "@/components/asisten/MarkdownView";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import "../study-flows.css";

type Course = {
  token: string;
  title: string;
  index: number;
  passes: number;
  question: string;
  feedback: string;
  chapters: { title: string; material: string }[];
};

const setupSteps = ["Tujuan", "Materi", "Tinjau"] as const;
const goals = [
  { title: "Persiapan ulangan", icon: Pencil },
  { title: "Latihan UTBK", icon: Target },
  { title: "Persiapan SNBP", icon: GraduationCap },
  { title: "Kejar IPK", icon: Trophy },
];

export default function Page() {
  const [ready, setReady] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(0);
  const [practice, setPractice] = useState(false);
  const [title, setTitle] = useState("");
  const [material, setMaterial] = useState("");
  const [noteId, setNoteId] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState<"create" | "answer" | null>(null);
  const [error, setError] = useState("");
  const panel = useRef<HTMLElement>(null);
  const shouldFocus = useRef(false);
  useEffect(() => {
    if (shouldFocus.current) panel.current?.focus();
    shouldFocus.current = false;
  }, [step, editing, selected, practice, busy, course]);

  const requestRef = useRef<AbortController | null>(null);
  const setup = !course || editing;
  const { notes, loading: notesLoading, error: notesError, refresh: refreshNotes } = useDashboardNotes(ready && setup && step > 0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("eureka:mission-learning:" + getUserId());
      if (saved) {
        const value: Course = JSON.parse(saved);
        if (value.token && value.chapters?.length) {
          setCourse(value);
          setSelected(Math.min(value.index, value.chapters.length - 1));
        }
      }
    } catch {
      // Storage may be unavailable.
    }
    setReady(true);
    return () => requestRef.current?.abort();
  }, []);

  async function submit(action: "create" | "answer") {
    if (requestRef.current || (action === "answer" && !course)) return;
    const request = new AbortController();
    requestRef.current = request;
    setBusy(action);
    setError("");
    const storageKey = "eureka:mission-learning:" + getUserId();
    try {
      const res = await apiFetch("/api/missions/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: request.signal,
        body: JSON.stringify(action === "create"
          ? { action, title: title.trim(), material, noteId: noteId || undefined }
          : { action, token: course?.token, answer: answer.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Misi belum bisa diproses. Coba lagi.");
      if (request.signal.aborted) return;
      shouldFocus.current = true;
      setCourse(data);
      setSelected(Math.min(data.index, data.chapters.length - 1));
      setPractice(action === "answer" && data.index === course?.index);
      setEditing(false);
      setAnswer("");
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch {
        setError("Progres belum tersimpan di perangkat ini.");
      }
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "Coba lagi.");
    } finally {
      if (requestRef.current === request) {
        requestRef.current = null;
        setBusy(null);
      }
    }
  }

  function changeChapter(index: number) {
    if (index !== selected || practice) shouldFocus.current = true;
    setSelected(index);
    setPractice(false);
    setError("");
  }

  function startNewMission() {
    shouldFocus.current = true;
    setStep(0);
    setTitle("");
    setMaterial("");
    setNoteId("");
    setEditing(true);
    setError("");
  }

  const noteTitle = notes.find(note => note.id === noteId)?.title;

  return (
    <V2FeaturePage title="Misi belajar" art={3} guide="missions">
      <main className="study-flow mission-flow">
        <header className="flow-heading">
          <h1>{setup ? "Misi belajar" : course.title}</h1>
          {setup && <p>Susun jalur belajar bersama Momo, satu bab pada satu waktu.</p>}
        </header>

        {!ready ? <p role="status">Memuat progres misi...</p> : setup ? (
          <div className="mission-setup">
            <ol className="mission-steps" aria-label="Langkah pembuatan misi">
              {setupSteps.map((label, index) => (
                <li key={label} aria-current={step === index ? "step" : undefined} data-done={index < step}>
                  <span aria-hidden="true">{index < step ? <Check size={15} /> : index + 1}</span>{label}
                </li>
              ))}
            </ol>
            {busy === "create" ? (
              <section className="flow-panel mission-wait" role="status">
                <Image src="/images/momo-mission.webp" alt="" width={138} height={112} />
                <h2>Momo sedang menyusun misi</h2>
                <p className="flow-description">{title}</p>
                <span className="mission-wait-track" aria-hidden="true" />
              </section>
            ) : (
              <section className="flow-panel" ref={panel} tabIndex={-1} aria-label={setupSteps[step]}>
                <form key={step} className="flow-form mission-learning-form" onSubmit={event => {
                  event.preventDefault();
                  if (step < 2) { shouldFocus.current = true; setError(""); setStep(step + 1); }
                  else void submit("create");
                }}>
                  {step === 0 && <>
                    <h2>Apa target belajarmu?</h2>
                    <div className="mission-goals">
                      {goals.map(({ title: goal, icon: Icon }) => (
                        <button type="button" key={goal} aria-pressed={title === goal} onClick={() => setTitle(goal)}><Icon size={17} aria-hidden="true" />{goal}</button>
                      ))}
                    </div>
                    <label>Tujuan belajarmu
                      <input required minLength={5} maxLength={160} value={title} onChange={event => setTitle(event.target.value)} placeholder="Contoh: Ulangan persamaan kuadrat" />
                    </label>
                  </>}
                  {step === 1 && <>
                    <h2>Materi apa yang ingin kamu pakai?</h2>
                    <label>Catatan
                      <select value={noteId} onChange={event => setNoteId(event.target.value)} disabled={notesLoading}>
                        <option value="">{notesLoading ? "Memuat catatan..." : "Gunakan rekomendasi Momo"}</option>
                        {notes.map(note => <option key={note.id} value={note.id}>{note.title}</option>)}
                      </select>
                    </label>
                    {notesError && <p className="flow-error" role="alert">{notesError} <button className="flow-text-action" type="button" onClick={refreshNotes}>Muat ulang</button></p>}
                    <label>Materi tambahan <small>(opsional)</small>
                      <textarea maxLength={16000} value={material} onChange={event => setMaterial(event.target.value)} placeholder="Tempel materi atau tulis bagian yang masih sulit." />
                    </label>
                    <Link className="flow-text-action" href="/dashboard-v2?mode=note">Buat catatan dari dokumen</Link>
                  </>}
                  {step === 2 && <>
                    <h2>Tinjau misi</h2>
                    <dl className="flow-summary">
                      <div><dt>Tujuan</dt><dd>{title.trim()}</dd></div>
                      <div><dt>Materi</dt><dd>{noteTitle || (noteId ? "Catatan yang dipilih" : material.trim() ? "Materi yang kamu tulis" : "Rekomendasi Momo")}</dd></div>
                      {material.trim() && <div><dt>Materi tambahan</dt><dd className="mission-summary-material">{material.trim()}</dd></div>}
                    </dl>
                    {course && <p className="flow-description">Misi baru akan menggantikan misi lama setelah selesai dibuat.</p>}
                  </>}
                  {error && <p className="flow-error" role="alert">{error}</p>}
                  <div className="flow-actions">
                    {step > 0 && <button className="flow-button secondary" type="button" onClick={() => { shouldFocus.current = true; setError(""); setStep(step - 1); }}><ArrowLeft size={16} /> Kembali</button>}
                    {step === 0 && editing && <button className="flow-button secondary" type="button" onClick={() => { shouldFocus.current = true; setError(""); setEditing(false); }}>Batal</button>}
                    <button className="flow-button" type="submit" disabled={step === 0 && title.trim().length < 5}>
                      {step === 0 ? "Pilih materi" : step === 1 ? "Tinjau misi" : "Susun misi"} <ArrowRight size={16} />
                    </button>
                  </div>
                </form>
              </section>
            )}
          </div>
        ) : (
          <div className="flow-layout mission-layout">
            <aside className="mission-chapters">
              <p className="mission-track-heading">{course.index} dari {course.chapters.length} bab selesai</p>
              <progress value={course.index} max={course.chapters.length} aria-label="Progres misi" />
              <ol className="mission-learning-path">
                {course.chapters.map((chapter, index) => (
                  <li key={index}>
                    <button type="button" aria-current={index === selected ? "step" : undefined} disabled={index > course.index || !!busy} onClick={() => changeChapter(index)}>
                      <span aria-hidden="true">{index < course.index ? <Check size={16} /> : index > course.index ? <Lock size={15} /> : index + 1}</span>
                      {chapter.title}
                      {index > course.index && <span className="sr-only">Terkunci</span>}
                    </button>
                  </li>
                ))}
              </ol>
              <label className="mission-chapter-picker">Buka bab
                <select value={selected} disabled={!!busy} onChange={event => changeChapter(Number(event.target.value))}>
                  {course.chapters.map((chapter, index) => (
                    <option key={index} value={index} disabled={index > course.index}>{index + 1}. {chapter.title}{index > course.index ? " (terkunci)" : ""}</option>
                  ))}
                </select>
              </label>
              <button className="flow-text-action mission-manage" type="button" disabled={!!busy} onClick={startNewMission}>Buat misi baru</button>
            </aside>
            <section className="flow-panel mission-lesson" ref={panel} tabIndex={-1} aria-label="Bab misi" aria-busy={busy === "answer"}>
              {course.index === course.chapters.length && <p className="flow-success" role="status"><Check size={17} /> Semua bab misi selesai.</p>}
              <p className="flow-description">Bab {selected + 1} dari {course.chapters.length}</p>
              <h2>{course.chapters[selected]?.title}</h2>
              {selected === Math.min(course.index, course.chapters.length - 1) && course.feedback && (
                <div className="mission-feedback"><strong>Masukan terakhir dari Momo</strong><p>{course.feedback}</p></div>
              )}
              {practice && selected === course.index ? (
                <form className="flow-form" onSubmit={event => { event.preventDefault(); void submit("answer"); }}>
                  <h3>Latihan pemahaman</h3>
                  <p>{course.question}</p>
                  <p className="flow-description">{course.passes} dari 2 jawaban tepat berturut-turut untuk membuka bab berikutnya.</p>
                  <label>Jelaskan dengan kata-katamu
                    <textarea required minLength={3} maxLength={4000} value={answer} disabled={!!busy} onChange={event => setAnswer(event.target.value)} />
                  </label>
                  {busy === "answer" && <p className="mission-answer-wait" role="status">Momo sedang meninjau jawabanmu <span className="mission-wait-track" aria-hidden="true" /></p>}
                  <div className="flow-actions">
                    <button className="flow-button secondary" disabled={!!busy} type="button" onClick={() => { shouldFocus.current = true; setPractice(false); }}><BookOpen size={16} /> Baca materi</button>
                    <button className="flow-button" disabled={!!busy || answer.trim().length < 3} type="submit">Kirim jawaban</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="mission-material"><MarkdownView content={course.chapters[selected]?.material || ""} /></div>
                  {selected === course.index && <div className="flow-actions"><button className="flow-button" type="button" onClick={() => { shouldFocus.current = true; setPractice(true); }}>Mulai latihan <ArrowRight size={16} /></button></div>}
                  {selected < Math.min(course.index, course.chapters.length - 1) && <div className="flow-actions"><button className="flow-button" type="button" onClick={() => changeChapter(selected + 1)}>Bab berikutnya <ArrowRight size={16} /></button></div>}
                </>
              )}
              {error && <p className="flow-error" role="alert">{error}</p>}
            </section>
          </div>
        )}
      </main>
    </V2FeaturePage>
  );
}
