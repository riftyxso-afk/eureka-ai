"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, X } from "lucide-react";
import { startTutorial } from "@/lib/tutorial";

const DISMISS_KEY = "eureka_empty_notes_cta_dismissed";

interface EmptyNotesCtaProps {
  /** Jumlah catatan user; null = belum diketahui (jangan tampil). */
  notesCount: number | null;
}

/**
 * Banner "belum punya catatan" di halaman home — menawarkan bantuan lewat
 * tutorial realtime (spotlight) yang langsung menyorot tombol & menu asli.
 */
export default function EmptyNotesCta({ notesCount }: EmptyNotesCtaProps) {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (notesCount !== 0 || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // abaikan
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.3 }}
      className="mx-auto mb-6 w-full max-w-2xl"
    >
      <div className="relative overflow-hidden rounded-clay-md border-2 border-clay-primary/30 bg-gradient-to-br from-clay-primary/10 via-white to-clay-secondary/10 p-4 shadow-clay-sm sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-clay-primary text-white shadow-clay-btn sm:h-12 sm:w-12">
            <GraduationCap size={22} className="sm:size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-extrabold leading-snug text-clay-dark sm:text-base">
              Hmm, kamu belum punya catatan nih
            </p>
            <p className="mt-1 text-[13px] font-semibold leading-relaxed text-clay-muted sm:text-sm">
              Mau aku bantu bikin catatan pertamamu? Aku tunjukkan caranya —
              langkah demi langkah, langsung di tombol & menunya.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => void startTutorial()}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-clay-md bg-clay-primary px-4 py-2 text-xs font-extrabold text-white shadow-clay-btn transition-all duration-75 hover:-translate-y-0.5 active:translate-y-1 sm:text-sm"
              >
                Ya, bantu aku
              </button>
              <button
                onClick={dismiss}
                className="inline-flex min-h-[40px] items-center rounded-clay-md border-2 border-clay-shadow/40 bg-white px-4 py-2 text-xs font-extrabold text-clay-muted transition-all duration-75 hover:text-clay-dark sm:text-sm"
              >
                Nanti saja
              </button>
            </div>
          </div>
          <button
            onClick={dismiss}
            aria-label="Tutup"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-clay-muted transition-colors hover:bg-white/70 hover:text-clay-dark"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
