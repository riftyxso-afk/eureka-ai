"use client";

import { useState } from "react";
import { Check, HelpCircle, Sparkles, X } from "lucide-react";
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
    <div className="card-clay rounded-clay p-4 shadow-clay-sm sm:p-5">
      <div className="flex items-start gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-clay-full bg-clay-primary/15 text-clay-primary">
          <HelpCircle size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-clay-dark">
            Sebelum menjawab, Eureka butuh info ini
          </p>
          <p className="mt-0.5 text-xs font-semibold text-clay-muted">
            Promptmu kurang jelas — jawab pertanyaan berikut agar jawabannya
            tepat sasaran.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {questions.map((q) => {
          const chosen = selected[q.id];
          return (
            <div key={q.id}>
              <p className="text-sm font-extrabold text-clay-dark">
                {q.question}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {q.options.map((opt) => {
                  const active = chosen === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        setSelected((prev) => ({ ...prev, [q.id]: opt }))
                      }
                      className={`flex items-center gap-1.5 rounded-clay-full border-2 px-3 py-1.5 text-xs font-extrabold transition-all duration-75 min-h-[38px] ${
                        active
                          ? "border-clay-primary bg-clay-primary text-white shadow-clay-btn"
                          : "border-clay-shadow/40 bg-white text-clay-dark hover:border-clay-primary/60"
                      }`}
                    >
                      {active && <Check size={13} />}
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onSkip}
          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-clay-muted transition-colors hover:text-clay-primary"
        >
          <X size={14} />
          Langsung jawab saja
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!allAnswered}
          className="btn-clay-primary inline-flex items-center justify-center gap-2 !min-h-[44px] !px-5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles size={16} />
          {allAnswered ? "Lanjutkan" : `Pilih ${questions.length - answered} lagi`}
        </button>
      </div>
    </div>
  );
}
