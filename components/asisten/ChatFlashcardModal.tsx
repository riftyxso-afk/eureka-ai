"use client";

import { useEffect, useRef, useState } from "react";
import PracticeLoading from "@/components/practice/PracticeLoading";
import PracticeFeedback from "@/components/practice/PracticeFeedback";
import { apiFetch } from "@/lib/apiClient";
import { motion, useReducedMotion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Loader2,
  RotateCw,
  Sparkles,
  X,
} from "lucide-react";
import { getUserId } from "@/lib/identity";
import { postProgress } from "@/lib/levelUp";

interface Flashcard {
  id: number;
  front: string;
  back: string;
}

/**
 * Flashcards dari percakapan sesi chat (command /card).
 * Materi: seluruh isi sesi + catatan yang di-mention. Hasil ephemeral —
 * tidak disimpan ke SRS (deck per catatan); XP tetap dicatat dengan
 * semantik yang sama seperti flashcards note (cards_add / cards_review_all)
 * tanpa kartu (array kosong) agar tidak mencemari ringkasan belajar.
 */
export default function ChatFlashcardModal({
  open,
  sessionId,
  onClose,
}: {
  open: boolean;
  sessionId: string;
  onClose: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const request = useRef<AbortController | null>(null);
  const completionPosted = useRef(false);
  const [finished, setFinished] = useState(false);
  const [ratings, setRatings] = useState<Record<number, "again" | "known">>({});
  const [feedback, setFeedback] = useState<{ outcome: "correct" | "wrong"; sequence: number } | null>(null);
  const [cards, setCards] = useState<Flashcard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    completionPosted.current = false;
    setFinished(false);
    setRatings({});
    setFeedback(null);
    setGenerating(true);
    setError(null);
    setIndex(0);
    setFlipped(false);
    try {
      const res = await apiFetch("/api/assistant/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, userId: getUserId() }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (controller.signal.aborted || request.current !== controller) return;
      if (!res.ok) {
        setError(data.error ?? "Gagal membuat flashcards.");
        return;
      }
      if (!Array.isArray(data.cards) || !data.cards.length) {
        setError("Kartu belum tersedia. Coba buat kartu lagi.");
        return;
      }
      setCards(data.cards.map((item: Flashcard, index: number) => ({ ...item, id: index + 1 })));
      if (Array.isArray(data.cards) && data.cards.length > 0) {
        void postProgress({
          action: "cards_add",
          userId: getUserId(),
          noteId: "",
          xp: 20,
          cards: [],
        });
      }
    } catch {
      if (!controller.signal.aborted) setError("Gagal terhubung ke server.");
    } finally {
      if (request.current === controller) setGenerating(false);
    }
  };

  // Auto-generate langsung saat modal dibuka (command /card): popup muncul
  // dengan state loading, tanpa perlu klik tombol.
  useEffect(() => {
    if (open) {
      setCards(null);
      setIndex(0);
      setFlipped(false);
      setError(null);
      void generate();
    }
    return () => request.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionId]);

  const card = cards?.[index];
  const known = cards?.filter(item => ratings[item.id] === "known").length ?? 0;
  const hard = cards?.filter(item => ratings[item.id] === "again").length ?? 0;

  function finish() {
    if (completionPosted.current) return;
    completionPosted.current = true;
    setFinished(true);
    void postProgress({ action: "cards_review_all", userId: getUserId(), noteId: "", xp: 10 });
  }

  function rate(rating: "again" | "known") {
    if (!card || !flipped || finished) return;
    setRatings(current => ({ ...current, [card.id]: rating }));
    setFeedback(current => ({ outcome: rating === "known" ? "correct" : "wrong", sequence: (current?.sequence ?? 0) + 1 }));
    if (index === cards!.length - 1) finish();
    else { setIndex(current => current + 1); setFlipped(false); }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 p-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card-clay m-auto w-full max-w-md max-h-[80dvh] overflow-y-auto sm:max-h-[85vh] p-3 sm:!p-6 rounded-clay !shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 sm:mb-4 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-extrabold text-clay-dark">
            <Layers size={18} className="mr-2 text-clay-primary" />
            Flashcards dari Percakapan
          </h2>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="btn-clay-ghost !min-h-[44px] !px-2.5"
          >
            <X size={16} />
          </button>
        </div>

        {!cards && !generating && (
          <div className="space-y-3 sm:space-y-4">
            <p className="rounded-clay-md border-2 border-dashed border-clay-shadow/40 p-3 sm:p-4 text-center text-xs sm:text-sm font-semibold text-clay-muted">
              Ubah materi percakapanmu menjadi kartu hafalan untuk belajar
              cepat!
            </p>
            <button
              onClick={generate}
              disabled={generating}
              className="btn-clay-primary w-full !min-h-[46px] sm:!min-h-[48px] disabled:opacity-60"
            >
              {generating ? (
                <>
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  Membuat kartu...
                </>
              ) : (
                <>
                  <Sparkles size={18} className="mr-2" />
                  Buat Flashcards
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

        {generating && <PracticeLoading kind="flashcards" />}
        {feedback && !finished && !generating && <PracticeFeedback key={feedback.sequence} outcome={feedback.outcome} correct={known} wrong={hard} selfRated />}
        {finished && cards && <div>
          <PracticeFeedback outcome="complete" correct={known} wrong={hard} selfRated ungraded={cards.length - known - hard} />
          <button type="button" className="btn-clay-primary w-full !min-h-[46px]" onClick={() => {
            completionPosted.current = false;
            setFinished(false);
            setIndex(0);
            setFlipped(false);
            setRatings({});
            setFeedback(null);
          }}>Ulangi latihan</button>
        </div>}

        {card && !generating && !finished && (
          <div className="space-y-3 sm:space-y-4">
            <div className="text-center text-xs font-bold text-clay-muted">
              Kartu {index + 1} dari {cards!.length}
            </div>

            {/* Kartu 3D — klik untuk balik */}
            <div className="[perspective:1400px]">
              <motion.div
                role="button"
                tabIndex={0}
                aria-label={flipped ? "Balik kartu ke pertanyaan" : "Balik kartu untuk melihat jawaban"}
                aria-pressed={flipped}
                onClick={() => setFlipped((f) => !f)}
                onKeyDown={event => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setFlipped(value => !value);
                  }
                }}
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.28, type: "tween", ease: "easeInOut" }}
                className="relative flex min-h-[200px] sm:min-h-[220px] cursor-pointer [transform-style:preserve-3d]"
              >
                {/* Sisi depan: Pertanyaan */}
                <div className="card-clay absolute inset-0 flex flex-col items-center justify-center !p-4 sm:!p-6 text-center [backface-visibility:hidden]">
                  <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-clay-muted">
                    Pertanyaan
                  </div>
                  <p className="text-sm sm:text-base font-extrabold leading-relaxed text-clay-dark">
                    {card.front}
                  </p>
                  <div className="mt-3 sm:mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-clay-muted">
                    <RotateCw size={12} />
                    Klik untuk balik
                  </div>
                </div>
                {/* Sisi belakang: Jawaban */}
                <div className="card-clay absolute inset-0 flex flex-col items-center justify-center !p-4 sm:!p-6 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-clay-primary">
                    Jawaban
                  </div>
                  <p className="text-sm sm:text-base font-bold leading-relaxed text-clay-dark">
                    {card.back}
                  </p>
                  <div className="mt-3 sm:mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-clay-muted">
                    <RotateCw size={12} />
                    Klik untuk balik
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="practice-card-rating">
              <button type="button" disabled={!flipped} onClick={() => rate("again")}>Masih belajar</button>
              <button type="button" disabled={!flipped} onClick={() => rate("known")}>Sudah paham</button>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
              <button
                onClick={() => {
                  setIndex((i) => Math.max(0, i - 1));
                  setFlipped(false);
                }}
                disabled={index === 0}
                className="btn-clay-ghost !min-h-[44px] !px-4 disabled:opacity-50"
              >
                <ChevronLeft size={17} className="mr-1" />
                Sebelumnya
              </button>
              <span className="text-sm font-extrabold text-clay-dark text-center">
                {index + 1}/{cards!.length}
              </span>
              <button
                onClick={() => {
                  if (index === cards!.length - 1) {
                    finish();
                  } else {
                    setIndex((i) => i + 1);
                    setFlipped(false);
                  }
                }}
                className="btn-clay-primary !min-h-[44px] !px-4"
              >
                {index === cards!.length - 1 ? "Selesai" : "Berikutnya"}
                <ChevronRight size={17} className="ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
