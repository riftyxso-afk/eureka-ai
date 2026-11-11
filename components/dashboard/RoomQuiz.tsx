"use client";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowLeft, ArrowRight, Check, RotateCcw, Settings2, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import type { QuizQuestion } from "@/lib/study-store";
import type { Note } from "@/lib/types";
import MarkdownView from "@/components/asisten/MarkdownView";
import PracticeLoading from "@/components/practice/PracticeLoading";
import PracticeFeedback from "@/components/practice/PracticeFeedback";

type Attempt = { questions: QuizQuestion[]; answers: Record<number, number>; checked: number[]; index: number; finished: boolean; count: number };
const EMPTY: Attempt = { questions: [], answers: {}, checked: [], index: 0, finished: false, count: 5 };
function questionsFrom(value: unknown): QuizQuestion[] {
  return Array.isArray(value) ? value.filter(q => q && typeof q.question === "string" && q.question.trim() && Array.isArray(q.options) && q.options.length >= 2 && q.options.every((v: unknown) => typeof v === "string") && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length).slice(0, 10).map((q, i) => ({ ...q, id: i + 1, explanation: typeof q.explanation === "string" ? q.explanation : "" })) : [];
}
export default function RoomQuiz({ note }: { note: Note }) {
  const [attempt, setAttempt] = useState<Attempt>(EMPTY);
  const [ready, setReady] = useState(false); const [settings, setSettings] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null); const lock = useRef(false);
  const key = `eureka:v2:quiz:${getUserId()}:${note.id}`;
  const revision = useMemo(() => JSON.stringify([note.title, note.chapters]), [note]);
  useEffect(() => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(key) || "null");
      const questions = questionsFrom(cached?.attempt?.questions);
      if (cached?.revision === revision && questions.length && questions.length === cached.attempt.questions.length) {
        const saved = cached.attempt;
        const answers: Record<number, number> = {};
        questions.forEach(q => { const answer = saved.answers?.[q.id]; if (Number.isInteger(answer) && answer >= 0 && answer < q.options.length) answers[q.id] = answer; });
        const checked = questions.filter(q => Array.isArray(saved.checked) && saved.checked.includes(q.id) && answers[q.id] !== undefined).map(q => q.id);
        setAttempt({ questions, answers, checked, index: Math.max(0, Math.min(questions.length - 1, Math.floor(Number(saved.index)) || 0)), count: [5, 8, 10].includes(saved.count) ? saved.count : 5, finished: !!saved.finished && checked.length === questions.length });
      }
    } catch { /* Practice can start fresh if session storage is unavailable. */ }
    setReady(true); return () => request.current?.abort();
  }, [key, revision]);
  useEffect(() => { if (ready && attempt.questions.length) { try { sessionStorage.setItem(key, JSON.stringify({ revision, attempt })); } catch {} } }, [attempt, key, ready, revision]);
  async function generate(fresh = false) {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    const controller = new AbortController(); request.current = controller;
    try {
      const response = await apiFetch(`/api/notes/${note.id}/quiz`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: attempt.count, reuse: !fresh }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(150000)]) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Soal belum bisa dibuat.");
      const questions = questionsFrom(data.questions); if (!questions.length) throw new Error("Soal belum tersedia. Coba lagi.");
      if (!controller.signal.aborted) { setAttempt(current => ({ ...EMPTY, count: current.count, questions })); setSettings(false); }
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error && failure.name === "TimeoutError" ? "AI membutuhkan waktu lebih lama. Coba lagi sebentar." : failure instanceof TypeError ? "Koneksi terputus. Periksa koneksi, lalu coba lagi." : failure instanceof Error ? failure.message : "Kuis belum bisa disiapkan."); }
    finally { lock.current = false; setBusy(false); }
  }
  const { questions, answers, checked, index, finished } = attempt;
  const question = questions[index]; const isChecked = question && checked.includes(question.id);
  const correct = questions.filter(q => checked.includes(q.id) && answers[q.id] === q.answer).length;
  const setup = !questions.length || settings;
  function chooseWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (!question || isChecked || !["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault(); const current = answers[question.id] ?? 0;
    const target = event.key === "Home" ? 0 : event.key === "End" ? question.options.length - 1 : (current + (["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1) + question.options.length) % question.options.length;
    setAttempt(value => ({ ...value, answers: { ...value.answers, [question.id]: target } }));
    event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="radio"]')[target]?.focus();
  }
  function check() { if (!question || answers[question.id] === undefined) return; setAttempt(current => ({ ...current, checked: [...new Set([...current.checked, question.id])] })); }
  function next() {
    if (checked.length === questions.length) { setAttempt(current => ({ ...current, finished: true })); return; }
    const after = questions.findIndex((q, i) => i > index && !checked.includes(q.id));
    const target = after >= 0 ? after : questions.findIndex(q => !checked.includes(q.id));
    setAttempt(current => ({ ...current, index: target < 0 ? current.index : target }));
  }
  return <section className="sp-page sp-quiz"><div className="rm-feature-heading"><div><h1>Kuis</h1><p>Uji pemahamanmu, satu pertanyaan setiap langkah.</p></div>{questions.length > 0 && !busy && <button className="sp-text-button" onClick={() => setSettings(value => !value)}><Settings2 size={15} />{settings ? "Kembali ke latihan" : "Atur latihan"}</button>}</div>
    <div className="sp-note-context"><span className="rm-nav-illustration" style={{ backgroundPosition: "0% 0%" }} aria-hidden="true" /><span><small>DARI CATATANMU</small><strong>{note.title}</strong></span></div>
    {error && <p className="rm-error" role="alert">{error}</p>}
    {busy ? <div className="sp-generation" aria-busy="true"><PracticeLoading kind="quiz" count={attempt.count} /><button className="sp-text-button" onClick={() => { request.current?.abort(); setBusy(false); }}>Hentikan pembuatan</button></div> : setup ? <div className="sp-setup"><span className="rm-nav-illustration sp-large-illustration" style={{ backgroundPosition: "0% 50%" }} aria-hidden="true" /><h2>Seberapa jauh kamu sudah paham?</h2><p>Soal disusun dari isi catatan. Setiap jawaban dilengkapi pembahasan agar kamu bisa belajar dari kesalahan.</p><fieldset><legend>Jumlah pertanyaan</legend><div>{[5, 8, 10].map(count => <button key={count} aria-pressed={attempt.count === count} onClick={() => setAttempt(current => ({ ...current, count }))}>{count} soal</button>)}</div></fieldset><button className="dv2-button" disabled={!ready} onClick={() => void generate()}>Mulai kuis <ArrowRight size={16} /></button><button className="sp-text-button" disabled={!ready} onClick={() => void generate(true)}>Buat soal baru dengan AI</button></div> : finished ? <div className="sp-results"><PracticeFeedback outcome="complete" correct={correct} wrong={questions.length - correct} /><small>LATIHAN SELESAI</small><h2>{correct === questions.length ? "Kamu menguasainya!" : "Satu langkah lebih paham."}</h2><div className="sp-result-score"><strong>{correct}<span>/{questions.length}</span></strong><p>jawaban benar</p></div><div className="sp-result-actions"><button className="dv2-button" onClick={() => setAttempt(current => ({ ...current, answers: {}, checked: [], index: 0, finished: false }))}><RotateCcw size={15} />Ulangi soal ini</button><button className="sp-text-button" onClick={() => setSettings(true)}>Susun latihan baru</button></div><div className="sp-review"><h3>Pembahasan latihan</h3>{questions.map((q, i) => <details key={q.id}><summary><span className={`sp-review-icon ${answers[q.id] === q.answer ? "is-correct" : "is-wrong"}`}>{answers[q.id] === q.answer ? <Check size={14} /> : <X size={14} />}</span><strong>{i + 1}. {q.question}</strong></summary><div><p>Jawabanmu: <strong>{q.options[answers[q.id]]}</strong></p><p>Jawaban tepat: <strong>{q.options[q.answer]}</strong></p><MarkdownView content={q.explanation || "Coba pelajari kembali bagian terkait di catatanmu."} /></div></details>)}</div></div> : question && <div className="sp-practice"><div className="sp-progress"><span>{checked.length} dari {questions.length} soal diperiksa</span><progress value={checked.length} max={questions.length} aria-label="Progres kuis" /></div><div className="sp-quiz-layout"><aside className="sp-question-map" aria-label="Navigasi soal"><h3>Langkahmu</h3><div>{questions.map((q, i) => <button key={q.id} aria-label={`Buka soal ${i + 1}`} aria-current={index === i ? "step" : undefined} className={checked.includes(q.id) ? answers[q.id] === q.answer ? "is-correct" : "is-wrong" : answers[q.id] !== undefined ? "has-answer" : ""} onClick={() => setAttempt(current => ({ ...current, index: i }))}>{i + 1}</button>)}</div><p>Pilih nomor untuk meninjau pertanyaan.</p></aside><div className="sp-question-panel"><p className="sp-eyebrow">PERTANYAAN {index + 1} / {questions.length}</p><h2>{question.question}</h2><div className="sp-choices" onKeyDown={chooseWithKeyboard} role="radiogroup" aria-label={`Pilihan jawaban soal ${index + 1}`}>{question.options.map((option, i) => <button role="radio" tabIndex={(answers[question.id] ?? 0) === i ? 0 : -1} aria-checked={answers[question.id] === i} disabled={isChecked} key={i} className={`${answers[question.id] === i ? "is-selected" : ""} ${isChecked && i === question.answer ? "is-correct" : ""} ${isChecked && answers[question.id] === i && i !== question.answer ? "is-wrong" : ""}`} onClick={() => setAttempt(current => ({ ...current, answers: { ...current.answers, [question.id]: i } }))}><span>{String.fromCharCode(65 + i)}</span><strong>{option}</strong>{isChecked && i === question.answer && <Check size={18} />}</button>)}</div>{isChecked && <div className={`sp-feedback ${answers[question.id] === question.answer ? "is-correct" : "is-wrong"}`} ><PracticeFeedback key={question.id} outcome={answers[question.id] === question.answer ? "correct" : "wrong"} correct={correct} wrong={checked.length - correct} /><MarkdownView content={question.explanation || `Jawaban tepat: ${question.options[question.answer]}`} /></div>}<div className="sp-question-actions"><button className="sp-text-button" disabled={index === 0} onClick={() => setAttempt(current => ({ ...current, index: current.index - 1 }))}><ArrowLeft size={15} />Sebelumnya</button>{isChecked ? <button className="dv2-button" onClick={next}>{checked.length === questions.length ? "Lihat hasil" : "Soal berikutnya"}<ArrowRight size={16} /></button> : <button className="dv2-button" disabled={answers[question.id] === undefined} onClick={check}>Periksa jawaban <Check size={16} /></button>}</div></div></div></div>}
    <p className="sp-device-hint">Jawaban latihan tersimpan pada sesi browser ini.</p>
  </section>;
}
