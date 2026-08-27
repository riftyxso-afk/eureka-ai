"use client";

import { Check, Lightbulb, Loader2 } from "lucide-react";

import type { QuizQuestion } from "@/lib/quizLiveClient";

/**
 * UI ambil kuis (pilihan ganda) — dipakai bersama view share & play room.
 * - submitted=false: pilih jawaban per soal → onSubmit().
 * - submitted=true: kunci jawaban (hijau/merah) + skor + penjelasan.
 */
export default function QuizTake({
  questions,
  answers,
  submitted,
  busy,
  notify,
  onAnswer,
  onSubmit,
}: {
  questions: QuizQuestion[];
  answers: Record<string, number>;
  submitted: boolean;
  busy: boolean;
  notify: (msg: string) => void;
  onAnswer: (qid: string, optionIdx: number) => void;
  onSubmit: () => void;
}) {
  const answeredCount = Object.keys(answers).length;
  const score = questions.filter((q) => answers[q.id] === q.answer).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-extrabold text-clay-dark">
          {submitted
            ? `Skor: ${score}/${questions.length}`
            : `${answeredCount}/${questions.length} soal dijawab`}
        </div>
        {busy && (
          <Loader2 size={16} className="animate-spin text-clay-primary" />
        )}
      </div>

      {questions.map((q, qi) => {
        const chosen = answers[q.id];
        return (
          <div
            key={q.id}
            className="rounded-clay-md border-2 border-clay-shadow/40 bg-clay-cream/60 p-3 sm:p-4"
          >
            <div className="mb-2 text-xs sm:text-sm font-extrabold text-clay-dark leading-relaxed">
              {qi + 1}. {q.question}
            </div>
            <div className="space-y-1.5">
              {q.options.map((opt, oi) => {
                let cls = "border-clay-shadow/40 hover:border-clay-primary/50";
                if (submitted) {
                  if (oi === q.answer) cls = "border-green-400 bg-green-50";
                  else if (chosen === oi) cls = "border-red-300 bg-red-50";
                  else cls = "border-clay-shadow/40 opacity-70";
                } else if (chosen === oi) {
                  cls = "border-clay-primary bg-clay-primary/10";
                }
                return (
                  <button
                    key={oi}
                    disabled={submitted || busy}
                    onClick={() => onAnswer(q.id, oi)}
                    className={`flex w-full items-center gap-2 rounded-xl border-2 bg-clay-cream px-3 py-2.5 sm:py-3 text-left text-xs sm:text-sm font-semibold text-clay-dark transition-colors disabled:cursor-default min-h-[44px] ${cls}`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
                        oi === 0
                          ? "bg-violet-200 text-violet-800"
                          : oi === 1
                            ? "bg-amber-200 text-amber-800"
                            : oi === 2
                              ? "bg-emerald-200 text-emerald-800"
                              : "bg-sky-200 text-sky-800"
                      }`}
                    >
                      {submitted && oi === q.answer ? (
                        <Check size={13} />
                      ) : (
                        String.fromCharCode(65 + oi)
                      )}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
            {submitted && q.explanation && (
              <p className="mt-2 flex items-start gap-2 rounded-xl bg-clay-beige px-3 py-2 text-xs font-medium text-clay-dark leading-relaxed">
                <Lightbulb size={14} className="mt-0.5 shrink-0 text-clay-secondary" />
                <span>{q.explanation}</span>
              </p>
            )}
          </div>
        );
      })}

      {!submitted && (
        <button
          onClick={() => {
            if (answeredCount < questions.length) {
              notify("Jawab semua soal dulu ya!");
              return;
            }
            onSubmit();
          }}
          disabled={busy}
          className="btn-clay-primary w-full !min-h-[46px] sm:!min-h-[48px] disabled:opacity-60"
        >
          {busy ? "Mengirim..." : "Kumpulkan Jawaban"}
        </button>
      )}
    </div>
  );
}