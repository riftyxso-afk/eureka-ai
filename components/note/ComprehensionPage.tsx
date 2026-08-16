"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { streamComprehension } from "@/lib/comprehensionStream";
import { getUserId } from "@/lib/identity";
import WritingBook from "@/components/note/WritingBook";
import {
  ArrowLeft,
  BookOpenCheck,
  Check,
  CheckCircle2,
  FileUp,
  Loader2,
  RotateCcw,
  Sparkles,
  Square,
  Upload,
  XCircle,
} from "lucide-react";
import type {
  ComprehensionDifficulty,
  ComprehensionQuestion,
  ComprehensionType,
  EssayGrade,
} from "@/lib/studyTools";

type Mode = "materi" | "upload";
type Stage = "setup" | "writing" | "work" | "result";

const DIFFICULTIES: { value: ComprehensionDifficulty; label: string }[] = [
  { value: "mudah", label: "Mudah" },
  { value: "sedang", label: "Sedang" },
  { value: "sulit", label: "Sulit" },
];

const COUNT_OPTIONS = [3, 5, 8, 10, 15];

export default function ComprehensionPage({
  noteId,
  noteTitle,
}: {
  noteId: string;
  noteTitle?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("materi");
  const [stage, setStage] = useState<Stage>("setup");

  // Pengaturan (mode materi)
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<ComprehensionDifficulty>("sedang");
  const [types, setTypes] = useState<ComprehensionType[]>(["abc", "essay"]);

  // Upload (mode lembar soal)
  const [sheetFile, setSheetFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Streaming realtime
  const [streamText, setStreamText] = useState("");
  const streamAbortRef = useRef<(() => void) | null>(null);
  const streamEndRef = useRef<Promise<void> | null>(null);

  const [questions, setQuestions] = useState<ComprehensionQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [essayAnswers, setEssayAnswers] = useState<Record<number, string>>({});
  const [grades, setGrades] = useState<Record<number, EssayGrade>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bersihkan stream saat komponen dilepas (pindah halaman).
  useEffect(() => {
    return () => {
      streamAbortRef.current?.();
    };
  }, []);

  const toggleType = (t: ComprehensionType) => {
    setTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const startFromMaterial = async () => {
    if (types.length === 0) {
      setError("Pilih minimal satu tipe soal.");
      return;
    }
    setError(null);
    setLoading(true);
    setStreamText("");
    setStage("writing");

    const { abort, completed } = await streamComprehension(
      {
        noteId,
        userId: getUserId(),
        count,
        difficulty,
        types,
      },
      (ev) => {
        if (ev.type === "token") {
          setStreamText((prev) => prev + ev.text);
        } else if (ev.type === "done") {
          setQuestions(ev.questions ?? []);
          setAnswers({});
          setEssayAnswers({});
          setGrades({});
          setStage("work");
          setLoading(false);
        } else if (ev.type === "error") {
          setError(ev.message || "Gagal membuat soal.");
          setLoading(false);
          // Kembalikan ke setup agar user bisa coba lagi (teks tetap tampil).
          setStage("setup");
        }
      }
    );
    streamAbortRef.current = abort;
    streamEndRef.current = completed;
    try {
      await completed;
    } catch {
      // abort / error stream — pesan ditangani lewat event error.
    } finally {
      setLoading(false);
      streamAbortRef.current = null;
    }
  };

  const stopStreaming = () => {
    streamAbortRef.current?.();
    setLoading(false);
    setStage("setup");
  };

  const startFromUpload = async () => {
    if (!sheetFile) {
      setError("Pilih file lembar soal dulu (foto JPG/PNG atau PDF).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", sheetFile);
      const res = await apiFetch(`/api/notes/${noteId}/comprehension/upload`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal membaca lembar soal.");
        return;
      }
      const qs: ComprehensionQuestion[] = data.questions ?? [];
      if (qs.length === 0) {
        setError("Tidak ada soal yang terbaca dari lembar.");
        return;
      }
      setQuestions(qs);
      setAnswers({});
      setEssayAnswers({});
      setGrades({});
      setStage("work");
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!questions) return;
    setLoading(true);
    setError(null);

    // Nilai ABC secara lokal (indeks), essay lewat AI.
    const abcGrades: Record<number, EssayGrade> = {};
    const essayQuestions: ComprehensionQuestion[] = [];
    for (const q of questions) {
      if (q.type === "abc") {
        const correct = answers[q.id] === q.answer;
        abcGrades[q.id] = {
          questionId: q.id,
          status: correct ? "benar" : "salah",
          feedback: q.explanation || "",
          modelAnswer: q.options?.[q.answer ?? 0] ?? "",
        };
      } else {
        essayQuestions.push(q);
      }
    }

    let essayResult: EssayGrade[] = [];
    if (essayQuestions.length > 0) {
      try {
        const res = await apiFetch(`/api/notes/${noteId}/comprehension/grade`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questions, answers: essayAnswers }),
        });
        const data = await res.json();
        if (res.ok) essayResult = data.grades ?? [];
      } catch {
        // Gagal grading essay → tetap tampilkan hasil ABC dengan catatan.
        essayResult = essayQuestions.map((q) => ({
          questionId: q.id,
          status: "kurang tepat" as const,
          feedback: "Gagal dinilai AI. Jawaban acuan:",
          modelAnswer: q.modelAnswer ?? "",
        }));
      }
    }

    const all = { ...abcGrades };
    for (const g of essayResult) all[g.questionId] = g;
    setGrades(all);
    setStage("result");
    setLoading(false);
  };

  const score = questions
    ? questions.filter((q) => grades[q.id]?.status === "benar").length
    : 0;

  const restart = () => {
    setQuestions(null);
    setAnswers({});
    setEssayAnswers({});
    setGrades({});
    setSheetFile(null);
    setStreamText("");
    setError(null);
    setStage("setup");
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      {/* Header halaman */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <button
          onClick={() => router.push(`/dashboard/note/${noteId}`)}
          className="btn-clay-ghost shrink-0 !min-h-[44px] !px-4 text-sm"
        >
          <ArrowLeft size={16} className="mr-2" /> Kembali
        </button>
        <button
          onClick={() => router.push(`/dashboard/note/${noteId}`)}
          className="hidden h-11 w-11 items-center justify-center rounded-full bg-clay-beige text-clay-muted shadow-clay-inset min-h-[44px] min-w-[44px] sm:flex"
          aria-label="Tutup"
        >
          <BookOpenCheck size={18} />
        </button>
      </div>

      <div className="card-clay rounded-clay p-4 sm:!p-8">
        <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-extrabold text-clay-dark">
          <BookOpenCheck size={22} className="text-clay-primary" /> Uji Pemahaman
        </h1>
        {noteTitle && (
          <p className="mt-1 line-clamp-2 text-xs sm:text-sm font-bold text-clay-muted">
            {noteTitle}
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-clay-md border-2 border-red-200 bg-red-50 px-3 py-2 text-xs sm:text-sm font-bold text-red-600">
            {error}
          </p>
        )}

        {stage === "setup" && (
          <div className="mt-6 space-y-4">
            {/* Pilih mode */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("materi")}
                className={`rounded-clay-md border-3 p-4 text-left transition-all duration-75 min-h-[96px] ${
                  mode === "materi"
                    ? "border-clay-primary bg-clay-primary/10"
                    : "border-clay-shadow/40 bg-white hover:-translate-y-0.5"
                }`}
              >
                <Sparkles size={20} className="text-clay-primary" />
                <span className="mt-2 block text-sm font-extrabold text-clay-dark">
                  Dari materi catatan
                </span>
                <span className="block text-xs font-bold text-clay-muted">
                  AI membuat soal dari isi catatan ini
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMode("upload")}
                className={`rounded-clay-md border-3 p-4 text-left transition-all duration-75 min-h-[96px] ${
                  mode === "upload"
                    ? "border-clay-primary bg-clay-primary/10"
                    : "border-clay-shadow/40 bg-white hover:-translate-y-0.5"
                }`}
              >
                <FileUp size={20} className="text-clay-primary" />
                <span className="mt-2 block text-sm font-extrabold text-clay-dark">
                  Upload lembar soal
                </span>
                <span className="block text-xs font-bold text-clay-muted">
                  Foto/scan soal (JPG, PNG, PDF) dibaca AI
                </span>
              </button>
            </div>

            {mode === "materi" ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs sm:text-sm font-extrabold text-clay-dark">
                    JUMLAH SOAL
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COUNT_OPTIONS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setCount(n)}
                        className={`rounded-clay-full px-4 py-2 text-sm font-extrabold transition-all duration-75 min-h-[40px] ${
                          count === n
                            ? "bg-clay-primary text-white shadow-clay-btn"
                            : "bg-clay-beige text-clay-muted shadow-clay-inset hover:text-clay-dark"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs sm:text-sm font-extrabold text-clay-dark">
                    TINGKAT KESULITAN
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DIFFICULTIES.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setDifficulty(d.value)}
                        className={`rounded-clay-full px-4 py-2 text-sm font-extrabold transition-all duration-75 min-h-[40px] ${
                          difficulty === d.value
                            ? "bg-clay-primary text-white shadow-clay-btn"
                            : "bg-clay-beige text-clay-muted shadow-clay-inset hover:text-clay-dark"
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs sm:text-sm font-extrabold text-clay-dark">
                    TIPE SOAL
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => toggleType("abc")}
                      className={`rounded-clay-full px-4 py-2 text-sm font-extrabold transition-all duration-75 min-h-[40px] ${
                        types.includes("abc")
                          ? "bg-clay-primary text-white shadow-clay-btn"
                          : "bg-clay-beige text-clay-muted shadow-clay-inset hover:text-clay-dark"
                      }`}
                    >
                      Pilihan ganda (ABC)
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleType("essay")}
                      className={`rounded-clay-full px-4 py-2 text-sm font-extrabold transition-all duration-75 min-h-[40px] ${
                        types.includes("essay")
                          ? "bg-clay-primary text-white shadow-clay-btn"
                          : "bg-clay-beige text-clay-muted shadow-clay-inset hover:text-clay-dark"
                      }`}
                    >
                      Essay
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={startFromMaterial}
                  disabled={loading}
                  className="btn-clay-primary w-full !min-h-[48px]"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Sparkles size={18} />
                  )}
                  {loading ? "Menyiapkan..." : "Buat Soal"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex w-full items-center justify-center gap-3 rounded-clay-md border-3 border-dashed px-4 py-8 text-sm sm:text-base font-extrabold transition-all duration-75 active:translate-y-1 min-h-[88px] ${
                    sheetFile
                      ? "border-clay-primary bg-clay-primary/10 text-clay-primary"
                      : "border-clay-shadow/60 text-clay-muted hover:border-clay-primary"
                  }`}
                >
                  <Upload size={20} />
                  {sheetFile ? sheetFile.name : "Pilih foto/PDF lembar soal..."}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const picked = e.target.files?.[0] ?? null;
                    setSheetFile(picked);
                    setError(null);
                  }}
                />
                <button
                  type="button"
                  onClick={startFromUpload}
                  disabled={loading}
                  className="btn-clay-primary w-full !min-h-[48px]"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <FileUp size={18} />
                  )}
                  {loading ? "Membaca soal..." : "Ekstrak Soal"}
                </button>
              </div>
            )}
          </div>
        )}

        {stage === "writing" && (
          <div className="mt-6">
            <WritingBook tokens={streamText.length} />
            <button
              type="button"
              onClick={stopStreaming}
              className="btn-clay-secondary mt-4 !min-h-[44px] !px-5 text-sm"
            >
              <Square size={14} className="mr-2" /> Hentikan
            </button>
          </div>
        )}

        {stage === "work" && questions && (
          <div className="mt-6 space-y-4">
            <p className="text-xs font-bold text-clay-muted">
              {questions.length} soal — jawab lalu tekan Kumpulkan.
            </p>
            {questions.map((q, i) => (
              <div key={q.id} className="rounded-clay-md border-3 border-clay-shadow/40 bg-white p-3 sm:p-4">
                <p className="text-sm sm:text-base font-extrabold text-clay-dark">
                  {i + 1}. {q.question}
                </p>
                <p className="mt-0.5 text-[10px] font-extrabold uppercase tracking-wide text-clay-muted">
                  {q.type === "abc" ? "Pilihan ganda" : "Essay"}
                </p>

                {q.type === "abc" ? (
                  <div className="mt-3 space-y-2">
                    {q.options?.map((opt, oi) => {
                      const selected = answers[q.id] === oi;
                      return (
                        <button
                          key={oi}
                          type="button"
                          onClick={() =>
                            setAnswers((prev) => ({ ...prev, [q.id]: oi }))
                          }
                          className={`flex w-full items-start gap-2 rounded-clay-md border-3 px-3 py-2 text-left text-sm font-bold transition-all duration-75 min-h-[44px] ${
                            selected
                              ? "border-clay-primary bg-clay-primary/10 text-clay-dark"
                              : "border-clay-shadow/40 bg-clay-inputBg text-clay-dark hover:border-clay-primary/50"
                          }`}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-clay-beige text-xs font-extrabold text-clay-muted shadow-clay-inset">
                            {String.fromCharCode(65 + oi)}
                          </span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <textarea
                    value={essayAnswers[q.id] ?? ""}
                    onChange={(e) =>
                      setEssayAnswers((prev) => ({
                        ...prev,
                        [q.id]: e.target.value,
                      }))
                    }
                    placeholder="Tulis jawabanmu di sini..."
                    rows={4}
                    className="mt-3 w-full resize-y rounded-clay-md border-3 border-clay-shadow/40 bg-clay-inputBg px-3 py-2 text-sm font-bold text-clay-dark shadow-clay-inset focus:border-clay-primary focus:outline-none"
                  />
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="btn-clay-primary w-full !min-h-[48px]"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Check size={18} />
              )}
              {loading ? "Menilai..." : "Kumpulkan Jawaban"}
            </button>
          </div>
        )}

        {stage === "result" && questions && (
          <div className="mt-6 space-y-4">
            <div className="rounded-clay-md border-3 border-clay-primary/40 bg-clay-primary/10 p-4 text-center">
              <p className="text-3xl font-extrabold text-clay-primary">
                {score}/{questions.length}
              </p>
              <p className="text-sm font-bold text-clay-muted">Skor kamu</p>
            </div>

            {questions.map((q, i) => {
              const g = grades[q.id];
              const correct = g?.status === "benar";
              return (
                <div
                  key={q.id}
                  className={`rounded-clay-md border-3 p-3 sm:p-4 ${
                    correct
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-amber-300 bg-amber-50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {correct ? (
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                    ) : (
                      <XCircle size={18} className="mt-0.5 shrink-0 text-amber-600" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-clay-dark">
                        {i + 1}. {q.question}
                      </p>
                      {q.type === "abc" ? (
                        <p className="mt-1 text-xs font-bold text-clay-muted">
                          Jawaban benar:{" "}
                          <span className="text-emerald-700">
                            {String.fromCharCode(65 + (q.answer ?? 0))}.{" "}
                            {q.options?.[q.answer ?? 0]}
                          </span>
                        </p>
                      ) : (
                        <p className="mt-1 text-xs font-bold text-clay-muted">
                          Jawaban acuan:{" "}
                          <span className="text-emerald-700">
                            {g?.modelAnswer || q.modelAnswer || "—"}
                          </span>
                        </p>
                      )}
                      <p className="mt-2 rounded-clay-md bg-white/70 px-2.5 py-2 text-xs font-semibold text-clay-dark">
                        {g?.feedback || q.explanation || "Tidak ada penjelasan."}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={restart}
              className="btn-clay-secondary w-full !min-h-[48px]"
            >
              <RotateCcw size={16} /> Coba Lagi
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
