"use client";

import ArrowUpRight from "kubai-icons-react/icons/arrow-up-right";
import { useState } from "react";
import type { StudyInteraction } from "@/lib/study-interaction";

export default function StudyActivities({ data, disabled, onSend, storageKey }: {
  data: StudyInteraction; disabled: boolean; onSend: (prompt: string) => void; storageKey: string;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [completed, setCompleted] = useState<string[]>(() => {
    try { const value = JSON.parse(localStorage.getItem(storageKey) || "[]"); return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; } catch { return []; }
  });

  function toggle(step: string) {
    const next = completed.includes(step) ? completed.filter(item => item !== step) : [...completed, step];
    setCompleted(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Checklist remains available in this tab. */ }
  }

  return <div className="study-chat-activities">
    {data.steps.length > 0 && <details open className="study-chat-plan"><summary>Langkah belajarmu · {completed.filter(step => data.steps.includes(step)).length}/{data.steps.length}</summary>
      {data.steps.map(step => <label key={step}><input type="checkbox" checked={completed.includes(step)} onChange={() => toggle(step)} /><span>{step}</span></label>)}
    </details>}
    {data.question && <fieldset className="study-chat-quiz">
      <legend>Coba jawab · {data.question.prompt}</legend>
      {data.question.options.map((option, index) => <button type="button" key={index} aria-pressed={choice === index} onClick={() => setChoice(index)}><span className="study-choice-letter">{String.fromCharCode(65 + index)}.</span> {option}</button>)}
      {choice !== null && <div role="status" className="study-chat-feedback">
        <strong>{choice === data.question.correct ? "Tepat!" : "Yuk, periksa lagi alasannya."}</strong><p>{data.question.explanation}</p>
        <button type="button" disabled={disabled} onClick={() => onSend("Aku menjawab " + data.question!.options[choice] + " untuk soal " + data.question!.prompt + ". Bantu aku memahami alasannya dengan contoh lain.")}>Bahas dengan Momo</button>
      </div>}
    </fieldset>}
    {data.suggestions.length > 0 && <div className="study-chat-suggestions">
      {data.suggestions.map(prompt => <button type="button" disabled={disabled} key={prompt} onClick={() => onSend(prompt)}>{prompt} <ArrowUpRight size={15} aria-hidden="true" /></button>)}
    </div>}
  </div>;
}
