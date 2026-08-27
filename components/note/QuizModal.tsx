"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { motion } from "framer-motion";
import {
  Check,
  Copy,
  Lightbulb,
  Link2,
  Loader2,
  Radio,
  RefreshCw,
  Rocket,
  Sparkles,
  X,
} from "lucide-react";
import {
  buildQuizUrl,
  createQuizRoom,
  createQuizShare,
  saveParticipantKey,
  saveRoomName,
} from "@/lib/quizLiveClient";

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export default function QuizModal({
  noteId,
  noteTitle,
  notify,
  onClose,
}: {
  noteId: string;
  noteTitle?: string;
  notify: (msg: string) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [count, setCount] = useState(5);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [generating, setGenerating] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Share & live room
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomToken, setRoomToken] = useState<string | null>(null);
  const [roomBusy, setRoomBusy] = useState(false);
  const [roomCopied, setRoomCopied] = useState(false);

  const generate = async (c: number = count) => {
    setGenerating(true);
    setError(null);
    setSubmitted(false);
    setAnswers({});
    try {
      const res = await apiFetch(`/api/notes/${noteId}/quiz`, {
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

  const doShare = async () => {
    if (!questions) return;
    setSharing(true);
    setError(null);
    try {
      const res = await createQuizShare({
        noteId,
        noteTitle: noteTitle ?? "",
        questions,
      });
      setShareToken(res.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat link.");
    } finally {
      setSharing(false);
    }
  };

  const copyShare = async () => {
    if (!shareToken) return;
    try {
      await navigator.clipboard.writeText(buildQuizUrl(shareToken));
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      notify("Gagal menyalin link.");
    }
  };

  const doCreateRoom = async () => {
    if (!questions) return;
    const name = roomName.trim();
    if (!name) {
      notify("Isi nama host dulu ya!");
      return;
    }
    setRoomBusy(true);
    setError(null);
    try {
      let token = shareToken;
      if (!token) {
        const share = await createQuizShare({
          noteId,
          noteTitle: noteTitle ?? "",
          questions,
        });
        token = share.token;
        setShareToken(token);
      }
      const room = await createQuizRoom({ shareToken: token, hostName: name });
      setRoomToken(room.token);
      saveParticipantKey(room.token, room.participantKey);
      saveRoomName(room.token, name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat ruang.");
    } finally {
      setRoomBusy(false);
    }
  };

  const copyRoom = async () => {
    if (!roomToken) return;
    try {
      await navigator.clipboard.writeText(buildQuizUrl(roomToken));
      setRoomCopied(true);
      setTimeout(() => setRoomCopied(false), 2000);
    } catch {
      notify("Gagal menyalin link.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 p-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card-clay m-auto w-full max-w-lg max-h-[80dvh] overflow-y-auto sm:max-h-[85vh] p-3 sm:!p-6 rounded-clay !shadow-none"
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

        {!questions && !generating && (
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
                <>
                  <Sparkles size={18} className="mr-2" />
                  Buat Kuis dari Catatan
                </>
              )}
            </button>
            {error && (
              <p className="rounded-clay-md border-2 border-red-200 bg-red-50 p-3 sm:p-4 text-xs sm:text-sm font-semibold text-red-600">
                {error}
              </p>
            )}
          </div>
        )}

        {!questions && generating && (
          <div className="space-y-3 sm:space-y-4" aria-live="polite">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="rounded-clay-md border-2 border-clay-shadow/40 bg-clay-cream/60 p-3 sm:p-4"
            >
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 animate-pulse rounded-full bg-clay-beige" />
                <span className="h-3.5 w-2/3 animate-pulse rounded-full bg-clay-beige" />
              </div>
              <div className="mt-3 space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: 0.15 + i * 0.12,
                      duration: 0.3,
                      ease: "easeOut",
                    }}
                    className="flex min-h-[44px] items-center gap-2 rounded-xl border-2 border-clay-shadow/40 bg-clay-cream px-3"
                  >
                    <span className="h-6 w-6 animate-pulse rounded-full bg-clay-beige" />
                    <span
                      className={`h-3 animate-pulse rounded-full bg-clay-beige ${
                        i % 2 === 0 ? "w-1/2" : "w-2/5"
                      }`}
                    />
                  </motion.div>
                ))}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.3, ease: "easeOut" }}
              className="flex min-h-[46px] sm:min-h-[48px] items-center justify-center gap-2 rounded-clay bg-clay-beige"
            >
              <Loader2 size={16} className="animate-spin text-clay-primary" />
              <span className="text-sm font-extrabold text-clay-muted">
                AI sedang menyusun {count} soal kuis...
              </span>
            </motion.div>
          </div>
        )}

        {questions && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-extrabold text-clay-dark">
                {submitted
                  ? `Skor: ${score}/${questions.length}`
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
                <div key={q.id} className="rounded-clay-md border-2 border-clay-shadow/40 bg-clay-cream/60 p-3 sm:p-4">
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
                  if (Object.keys(answers).length < questions.length) {
                    notify("Jawab semua soal dulu ya!");
                    return;
                  }
                  setSubmitted(true);
                }}
                className="btn-clay-primary w-full !min-h-[46px] sm:!min-h-[48px]"
              >
                Kumpulkan Jawaban
              </button>
            )}

            {submitted && (
              <div className="space-y-3 border-t-2 border-dashed border-clay-shadow/40 pt-4">
                <div className="flex gap-2">
                  <button
                    onClick={doShare}
                    disabled={sharing || !!shareToken}
                    className="btn-clay-ghost flex-1 !min-h-[44px] text-xs sm:text-sm disabled:opacity-50"
                  >
                    {sharing ? (
                      <Loader2 size={15} className="mr-1.5 animate-spin" />
                    ) : (
                      <Link2 size={15} className="mr-1.5" />
                    )}
                    {shareToken ? "Link Dibuat ✓" : "Bagikan Kuis"}
                  </button>
                  <button
                    onClick={doCreateRoom}
                    disabled={roomBusy || !!roomToken}
                    className="btn-clay-ghost flex-1 !min-h-[44px] text-xs sm:text-sm disabled:opacity-50"
                  >
                    {roomBusy ? (
                      <Loader2 size={15} className="mr-1.5 animate-spin" />
                    ) : (
                      <Radio size={15} className="mr-1.5" />
                    )}
                    {roomToken ? "Ruang Dibuat ✓" : "Buat Ruang Live"}
                  </button>
                </div>

                {shareToken && !roomToken && (
                  <div className="rounded-clay-md border-2 border-clay-shadow/40 bg-clay-cream/60 p-3">
                    <p className="mb-1.5 text-[11px] font-extrabold text-clay-muted">
                      Link kuis — kerjakan sendiri, kunci jawaban muncul
                      setelah submit:
                    </p>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={buildQuizUrl(shareToken)}
                        onFocus={(e) => e.target.select()}
                        className="min-w-0 flex-1 rounded-xl border-2 border-clay-shadow/40 bg-clay-cream px-3 py-2 text-[11px] font-semibold text-clay-muted outline-none"
                      />
                      <button
                        onClick={copyShare}
                        className="btn-clay-primary shrink-0 !min-h-[44px] !px-3 text-xs"
                      >
                        <Copy size={13} className="mr-1.5" />
                        {shareCopied ? "Tersalin!" : "Salin"}
                      </button>
                    </div>
                  </div>
                )}

                {!roomToken && (
                  <div className="rounded-clay-md border-2 border-clay-shadow/40 bg-clay-cream/60 p-3">
                    <label className="mb-1 block text-[11px] font-extrabold text-clay-muted">
                      Nama host (untuk ruang live):
                    </label>
                    <input
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="mis. Budi"
                      maxLength={40}
                      className="w-full rounded-xl border-2 border-clay-shadow/40 bg-clay-cream px-3 py-2 text-xs font-semibold text-clay-dark outline-none focus:border-clay-primary min-h-[44px]"
                    />
                  </div>
                )}

                {roomToken && (
                  <div className="space-y-2">
                    <div className="rounded-clay-md border-2 border-clay-primary/40 bg-clay-primary/10 p-3">
                      <p className="mb-1.5 text-[11px] font-extrabold text-clay-muted">
                        Link ruang live — bagikan ke teman, papan skor realtime:
                      </p>
                      <div className="flex gap-2">
                        <input
                          readOnly
                          value={buildQuizUrl(roomToken)}
                          onFocus={(e) => e.target.select()}
                          className="min-w-0 flex-1 rounded-xl border-2 border-clay-shadow/40 bg-clay-cream px-3 py-2 text-[11px] font-semibold text-clay-muted outline-none"
                        />
                        <button
                          onClick={copyRoom}
                          className="btn-clay-primary shrink-0 !min-h-[44px] !px-3 text-xs"
                        >
                          <Copy size={13} className="mr-1.5" />
                          {roomCopied ? "Tersalin!" : "Salin"}
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push(`/quiz/${roomToken}`)}
                      className="btn-clay-primary w-full !min-h-[46px]"
                    >
                      <Rocket size={18} className="mr-2" /> Buka Ruang & Mulai
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
