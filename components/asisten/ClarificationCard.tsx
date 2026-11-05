"use client";

import { useState } from "react";
import { ArrowRight, HelpCircle } from "lucide-react";
import type { ClarificationQuestion } from "@/lib/assistant-stream";

interface ClarificationCardProps {
  questions: ClarificationQuestion[];
  onAnswer: (answers: { id: string; question?: string; answer: string }[]) => void;
  onSkip: () => void;
}

/**
 * Kartu klarifikasi prompt ambigu — maksimal 3 pertanyaan pilihan ganda.
 * User memilih satu opsi per pertanyaan lalu Lanjutkan, atau langsung jawab.
 */
export default function ClarificationCard({
  questions,
  onAnswer,
  onSkip,
}: ClarificationCardProps) {
  const [selected, setSelected] = useState<Record<string, string>>({});

  const answered = Object.keys(selected).length;
  const allAnswered = answered === questions.length;

  const submit = () => {
    const answers = questions
      .map((q) =>
        selected[q.id]
          ? { id: q.id, question: q.question, answer: selected[q.id] }
          : null
      )
      .filter(
        (a): a is { id: string; question: string; answer: string } =>
          a !== null
      );
    if (answers.length > 0) onAnswer(answers);
  };

  return (
    <section aria-label="Klarifikasi pertanyaan" className="min-w-0 border-s-2 border-clay-primary/25 ps-3 sm:ps-5">
      <p className="flex items-center gap-2 text-sm font-extrabold text-clay-dark">
        <HelpCircle size={17} className="shrink-0 text-clay-primary" aria-hidden="true" />
        Pilih arah jawaban
      </p>

      <div className="mt-4 space-y-5">
        {questions.map((q) => {
          const chosen = selected[q.id];
          return (
            <fieldset key={q.id} className="min-w-0">
              <legend className="mb-1 text-sm font-bold text-clay-dark [overflow-wrap:anywhere]">
                {q.question}
              </legend>
              <div className="divide-y divide-clay-primary/10">
                {q.options.map((opt) => {
                  const active = chosen === opt;
                  return (
                    <label
                      key={opt}
                      className={`flex min-h-11 cursor-pointer items-center gap-3 px-2 py-2 text-sm font-semibold text-clay-dark ${active ? "bg-clay-primary/10" : "hover:bg-clay-primary/5"}`}
                    >
                      <input type="radio" name={`clarification-${q.id}`} checked={active} onChange={() => setSelected((prev) => ({ ...prev, [q.id]: opt }))} className="size-4 shrink-0 accent-violet-600" />
                      <span className="min-w-0 [overflow-wrap:anywhere]">{opt}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onSkip}
          className="inline-flex min-h-11 items-center text-sm font-bold text-clay-muted transition-colors hover:text-clay-primary"
        >
          Langsung jawab saja
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!allAnswered}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {allAnswered ? "Lanjutkan" : `Pilih ${questions.length - answered} lagi`}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
