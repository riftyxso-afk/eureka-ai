"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, RotateCw, X } from "lucide-react";
import { getUserId } from "@/lib/identity";

interface Flashcard {
  id: number;
  front: string;
  back: string;
}

export default function FlashcardModal({
  noteId,
  notify,
  onClose,
}: {
  noteId: string;
  notify: (msg: string) => void;
  onClose: () => void;
}) {
  const [cards, setCards] = useState<Flashcard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    setIndex(0);
    setFlipped(false);
    try {
      const res = await fetch(`/api/notes/${noteId}/flashcards`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal membuat flashcards.");
        return;
      }
      setCards(data.cards ?? []);
      if (Array.isArray(data.cards) && data.cards.length > 0) {
        fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "cards_add",
            userId: getUserId(),
            noteId,
            xp: 20,
            cards: data.cards.map((c: { front: string; back: string }) => ({
              front: c.front,
              back: c.back,
            })),
          }),
        }).catch(() => {});
      }
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      setGenerating(false);
    }
  };

  const card = cards?.[index];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="card-clay max-h-[85vh] w-full max-w-md overflow-y-auto !p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-clay-dark">
            Flashcards AI
          </h2>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="btn-clay-ghost !min-h-[36px] !px-2.5"
          >
            <X size={16} />
          </button>
        </div>

        {!cards && (
          <div className="space-y-4">
            <p className="rounded-2xl border-2 border-dashed border-clay-shadow/40 p-4 text-center text-sm font-semibold text-clay-muted">
              Ubah materi catatan menjadi kartu hafalan untuk belajar cepat! 🃏
            </p>
            <button
              onClick={generate}
              disabled={generating}
              className="btn-clay-primary w-full !min-h-[46px] disabled:opacity-60"
            >
              {generating ? (
                <>
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  Membuat kartu...
                </>
              ) : (
                "✨ Buat Flashcards"
              )}
            </button>
            {error && (
              <p className="rounded-2xl border-2 border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-600">
                {error}
              </p>
            )}
          </div>
        )}

        {card && (
          <div className="space-y-4">
            <div className="text-center text-xs font-bold text-clay-muted">
              Kartu {index + 1} dari {cards!.length}
            </div>

            {/* Kartu 3D — klik untuk balik */}
            <div className="[perspective:1400px]">
              <motion.div
                onClick={() => setFlipped((f) => !f)}
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.55, type: "tween", ease: "easeInOut" }}
                className="relative flex min-h-[220px] cursor-pointer [transform-style:preserve-3d]"
              >
                {/* Sisi depan: Pertanyaan */}
                <div className="card-clay absolute inset-0 flex flex-col items-center justify-center !p-6 text-center [backface-visibility:hidden]">
                  <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-clay-muted">
                    Pertanyaan
                  </div>
                  <p className="text-base font-extrabold leading-relaxed text-clay-dark">
                    {card.front}
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-clay-muted">
                    <RotateCw size={12} />
                    Klik untuk balik
                  </div>
                </div>
                {/* Sisi belakang: Jawaban */}
                <div className="card-clay absolute inset-0 flex flex-col items-center justify-center !p-6 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-clay-primary">
                    Jawaban
                  </div>
                  <p className="text-base font-bold leading-relaxed text-clay-dark">
                    {card.back}
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-clay-muted">
                    <RotateCw size={12} />
                    Klik untuk balik
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="flex items-center justify-between gap-3">
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
              <span className="text-sm font-extrabold text-clay-dark">
                {index + 1}/{cards!.length}
              </span>
              <button
                onClick={() => {
                  if (index === cards!.length - 1) {
                    setIndex(0);
                    notify("Selesai! Ulangi dari awal 🔁");
                    fetch("/api/progress", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "cards_review_all",
                        userId: getUserId(),
                        noteId,
                        xp: 10,
                      }),
                    }).catch(() => {});
                  } else {
                    setIndex((i) => i + 1);
                  }
                  setFlipped(false);
                }}
                className="btn-clay-primary !min-h-[44px] !px-4"
              >
                {index === cards!.length - 1 ? "Ulangi" : "Berikutnya"}
                <ChevronRight size={17} className="ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
