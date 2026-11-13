"use client";

import { useId, useState } from "react";
import MarkdownView from "@/components/asisten/MarkdownView";
import type { StudyInteraction } from "@/lib/study-interaction";

type Question = NonNullable<StudyInteraction["question"]>;
type ActivityProps = { onSend: (prompt: string) => void; disabled: boolean };

function Quiz({ question, onSend, disabled }: ActivityProps & { question: Question }) {
  const id = useId();
  const [choice, setChoice] = useState<number | null>(null);
  return <section className="study-chat-quiz" aria-labelledby={id}>
    <h3 id={id}><MarkdownView content={question.prompt} inline /></h3>
    {question.options.map((option, index) => <button
      key={index}
      type="button"
      disabled={choice !== null}
      aria-pressed={choice === index}
      onClick={() => setChoice(index)}
      data-result={choice === index ? (index === question.correct ? "correct" : "incorrect") : undefined}
    >
      <span className="study-choice-letter">{String.fromCharCode(65 + index)}</span>
      <MarkdownView content={option} className="study-choice-answer" inline />
    </button>)}
    {choice !== null && <div className="study-chat-feedback" role="status">
      <strong>{choice === question.correct ? "Tepat!" : "Belum tepat. Kita bahas alasannya."}</strong>
      <MarkdownView content={question.explanation} />
      <button type="button" disabled={disabled} onClick={() => onSend(
        `Aku memilih ${question.options[choice]} untuk soal ${question.prompt}. Bantu jelaskan alasannya.`,
      )}>Bahas jawaban</button>
      <button type="button" onClick={() => setChoice(null)}>Coba lagi</button>
    </div>}
  </section>;
}

function Essay({ question, disabled, onSend }: ActivityProps & { question: NonNullable<StudyInteraction["essays"]>[number] }) {
  const [answer, setAnswer] = useState("");
  return <section className="study-chat-quiz study-essay">
    <h3><MarkdownView content={question.prompt} inline /></h3>
    <label>Jawabanmu<textarea
      value={answer}
      onChange={event => setAnswer(event.target.value)}
      maxLength={3500}
      rows={4}
      placeholder="Tulis penjelasan dengan bahasamu sendiri…"
    /></label>
    <p>{answer.length}/3500 karakter</p>
    <button type="button" disabled={disabled || !answer.trim()} onClick={() => onSend(
      `Tinjau jawaban esai saya, jelaskan bagian yang tepat, koreksi, dan satu saran perbaikan. Soal: ${question.prompt}\nKriteria: ${question.rubric.join("; ")}\nJawaban: ${answer}`,
    )}>Minta umpan balik</button>
  </section>;
}

export default function StudyActivities({ data, disabled, onSend, storageKey }: ActivityProps & {
  data: StudyInteraction;
  storageKey: string;
}) {
  const [completed, setCompleted] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  });
  if (!data.requested) return null;
  const questions = data.questions || (data.question ? [data.question] : []);
  return <div className="study-chat-activities">
    {!!data.steps.length && <details className="study-chat-plan">
      <summary>Rencana belajarmu · {completed.length}/{data.steps.length}</summary>
      {data.steps.map(step => <label key={step}>
        <input type="checkbox" checked={completed.includes(step)} onChange={() => {
          const next = completed.includes(step) ? completed.filter(item => item !== step) : [...completed, step];
          setCompleted(next);
          try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* The checklist works for this visit. */ }
        }} />
        <MarkdownView content={step} inline />
      </label>)}
    </details>}
    {questions.map((question, index) => <Quiz key={index} question={question} disabled={disabled} onSend={onSend} />)}
    {data.essays?.map((question, index) => <Essay key={index} question={question} disabled={disabled} onSend={onSend} />)}
  </div>;
}