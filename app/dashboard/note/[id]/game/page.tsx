"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AnswerWorld from "@/components/game/AnswerWorld";
import { apiFetch } from "@/lib/apiClient";
import type { QuizQuestion } from "@/lib/study-store";
import "./game.css";

export default function NoteGamePage() {
  const { id } = useParams<{ id: string }>();
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<"loading" | "ready" | "generating" | "playing" | "done" | "error">("loading");
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const locked = useRef(false);
  const answered = useRef(false);

  useEffect(() => {
    const request = new AbortController(); controller.current = request;
    void apiFetch(`/api/notes/${encodeURIComponent(id)}`, { signal: request.signal }).then(async response => {
      if (!response.ok) throw new Error("Catatan belum bisa dibuka.");
      const data = await response.json();
      if (!request.signal.aborted) { setTitle(data.note?.title ?? "Catatan"); setPhase("ready"); }
    }).catch(() => { if (!request.signal.aborted) { setError("Catatan belum bisa dibuka. Silakan coba lagi."); setPhase("error"); } });
    return () => { request.abort(); controller.current?.abort(); };
  }, [id]);

  async function start() {
    if (locked.current) return;
    locked.current = true; setPhase("generating"); setError("");
    const request = new AbortController(); controller.current = request;
    try {
      const response = await apiFetch(`/api/notes/${encodeURIComponent(id)}/quiz`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: 5 }), signal: request.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Soal belum bisa dibuat.");
      const valid = Array.isArray(data.questions) ? data.questions.filter((q: QuizQuestion) => typeof q.question === "string" && Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= 4 && q.options.every(option => typeof option === "string") && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length) : [];
      if (!valid.length) throw new Error("Momo belum menemukan soal yang bisa dimainkan. Coba lagi.");
      if (!request.signal.aborted) { answered.current = false; setQuestions(valid); setIndex(0); setScore(0); setSelected(null); setPhase("playing"); }
    } catch (failure) {
      if (!request.signal.aborted) { setError(failure instanceof Error ? failure.message : "Soal belum bisa dibuat."); setPhase("ready"); }
    } finally { locked.current = false; }
  }

  function choose(option: number) {
    if (answered.current || phase !== "playing") return;
    answered.current = true;
    setSelected(option);
    if (option === questions[index].answer) setScore(value => value + 1);
  }
  function next() {
    if (index + 1 >= questions.length) setPhase("done");
    else { answered.current = false; setIndex(value => value + 1); setSelected(null); }
  }
  const question = questions[index];

  return <main className="game-page">
    <header className="game-header"><Link href={`/dashboard/note/${encodeURIComponent(id)}`}>← Kembali ke catatan</Link><span>Petualangan Momo</span></header>
    {phase === "loading" && <p role="status">Menyiapkan permainan…</p>}
    {phase === "error" && <p role="alert">{error}</p>}
    {(phase === "ready" || phase === "generating") && <section className="game-intro"><p className="game-kicker">BERMAIN SAMBIL BELAJAR</p><h1>Jelajahi dunia pengetahuan</h1><p>Momo akan menyiapkan lima pertanyaan dari <strong>{title}</strong>. Pilih planet atau tombol jawaban dan pelajari penjelasannya.</p><button type="button" disabled={phase === "generating"} onClick={() => void start()}>{phase === "generating" ? "Momo menyiapkan soal…" : "Mulai petualangan"}</button>{error && <p role="alert">{error}</p>}</section>}
    {phase === "playing" && question && <section className="game-play">
      <div className="game-status"><span>SOAL {index + 1} / {questions.length}</span><span>{score} BENAR</span></div>
      <progress max={questions.length} value={index + (selected === null ? 0 : 1)} aria-label="Progres permainan" />
      <h1>{question.question}</h1>
      <AnswerWorld key={question.options.length} count={question.options.length} selected={selected} onChoose={choose} />
      <p className="game-hint">Sentuh planet atau pilih jawaban di bawah.</p>
      <div className="game-options">{question.options.map((option, optionIndex) => <button type="button" key={optionIndex} disabled={selected !== null} data-correct={selected !== null && optionIndex === question.answer || undefined} data-wrong={selected === optionIndex && optionIndex !== question.answer || undefined} onClick={() => choose(optionIndex)}><span>{String.fromCharCode(65 + optionIndex)}</span>{option}</button>)}</div>
      {selected !== null && <div className="game-feedback" role="status"><strong>{selected === question.answer ? "Tepat!" : "Belum tepat, mari pelajari."}</strong><p>{question.explanation || `Jawaban yang tepat adalah ${question.options[question.answer]}.`}</p><button type="button" onClick={next}>{index + 1 === questions.length ? "Lihat hasil" : "Soal berikutnya"} →</button></div>}
    </section>}
    {phase === "done" && <section className="game-intro"><p className="game-kicker">PETUALANGAN SELESAI</p><h1>{score} dari {questions.length} jawaban tepat</h1><p>Bagus sudah berlatih. Kamu bisa mencoba soal baru atau kembali membaca catatan.</p><div className="game-actions"><button type="button" onClick={() => void start()}>Main lagi</button><Link href={`/dashboard/note/${encodeURIComponent(id)}`}>Kembali ke catatan</Link></div><p className="game-hint">Skor hanya berlaku untuk permainan ini dan tidak menambah XP.</p></section>}
  </main>;
}
