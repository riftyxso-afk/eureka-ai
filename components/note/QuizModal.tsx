"use client";

import { useState } from "react";
import { Check, Loader2, RefreshCw, X } from "lucide-react";

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export default function QuizModal({
  noteId,
  notify,
  onClose,
}: {
  noteId: string;
  notify: (msg: string) => void;
  onClose: () => void;
}) {
  const [count, setCount] = useState(5);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [generating, setGenerating] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (c: number = count) => {
    setGenerating(true);
    setError(null);
    setSubmitted(false);
    setAnswers({});
    try {
      const res = await fetch(`/api/notes/${noteId}/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: c }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal membuat kuis.");
        return;
      }
      setQuestions(data.questions ?? []);
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      setGenerating(false);
    }
  };

  const score = questions
    ? questions.filter((q) => answers[q.id] === q.answer).length
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="card-clay max-h-[85vh] w-full max-w-lg overflow-y-auto p-3 sm:!p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 sm:mb-4 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-extrabold text-clay-dark">Kuis AI</h2>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="btn-clay-ghost !min-h-[44px] !px-2.5"
          >
            <X size={16} />
          </button>
        </div>

        {!questions && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-clay-muted">
                Jumlah soal
              </label>
              <div className="flex gap-2">
                {[5, 8, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={`btn-clay-ghost flex-1 !min-h-[44px] text-sm ${
                      count === n
                        ? "!border-clay-primary !bg-clay-primary !text-white !shadow-clay-sm"
                        : ""
                    }`}
                  >
                    {n} soal
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => generate()}
              disabled={generating}
              className="btn-clay-primary w-full !min-h-[46px] sm:!min-h-[48px] disabled:opacity-60"
            >
              {generating ? (
                <>
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  Membuat soal...
                </>
              ) : (
                "✨ Buat Kuis dari Catatan"
              )}
            </button>
            {error && (
              <p className="rounded-2xl border-2 border-red-200 bg-red-50 p-3 sm:p-4 text-xs sm:text-sm font-semibold text-red-600">
                {error}
              </p>
            )}
          </div>
        )}

        {questions && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-extrabold text-clay-dark">
                {submitted
                  ? `Skor: ${score}/${questions.length} 🎯`
                  : `${questions.length} soal`}
              </div>
              <button
                onClick={() => generate()}
                disabled={generating}
                className="btn-clay-ghost !min-h-[34px] !px-3 text-xs"
              >
                <RefreshCw size={13} className="mr-1.5" />
                {generating ? "Membuat..." : "Ulangi"}
              </button>
            </div>

            {questions.map((q, qi) => {
              const chosen = answers[q.id];
              return (
                <div key={q.id} className="rounded-2xl border-2 border-clay-shadow/40 bg-white/60 p-3 sm:p-4">
                  <div className="mb-2 text-xs sm:text-sm font-extrabold text-clay-dark leading-relaxed">
                    {qi + 1}. {q.question}
                  </div>
                  <div className="space-y-1.5">
                    {q.options.map((opt, oi) => {
                      let cls =
                        "border-clay-shadow/40 hover:border-clay-primary/50";
                      if (submitted) {
                        if (oi === q.answer) cls = "border-green-400 bg-green-50";
                        else if (chosen === oi)
                          cls = "border-red-300 bg-red-50";
                        else cls = "border-clay-shadow/40 opacity-70";
                      } else if (chosen === oi) {
                        cls = "border-clay-primary bg-clay-primary/10";
                      }
                      return (
                        <button
                          key={oi}
                          disabled={submitted}
                          onClick={() =>
                            setAnswers((prev) => ({ ...prev, [q.id]: oi }))
                          }
                          className={`flex w-full items-center gap-2 rounded-xl border-2 bg-white px-3 py-2.5 sm:py-3 text-left text-xs sm:text-sm font-semibold text-clay-dark transition-colors disabled:cursor-default min-h-[44px] ${cls}`}
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
                    <p className="mt-2 rounded-xl bg-clay-beige px-3 py-2 text-xs font-medium text-clay-dark leading-relaxed">
                      💡 {q.explanation}
                    </p>
                  )}
                </div>
              );
            })}

            {!submitted && (
              <button
                onClick={() => {
                  if (Object.keys(answers).length < questions.length) {
                    notify("Jawab semua soal dulu ya! ⚠️");
                    return;
                  }
                  setSubmitted(true);
                }}
                className="btn-clay-primary w-full !min-h-[46px] sm:!min-h-[48px]"
              >
                Kumpulkan Jawaban
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
