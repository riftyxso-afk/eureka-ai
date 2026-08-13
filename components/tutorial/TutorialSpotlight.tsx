"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PartyPopper, X } from "lucide-react";
import type { TutorialStep } from "@/lib/tutorial";

interface TutorialSpotlightProps {
  active: boolean;
  /** Langkah saat ini (0-based). Bila >= steps.length → tampil kartu selesai. */
  step: number;
  steps: TutorialStep[];
  onAdvance: () => void;
  onComplete: () => void;
  onSkip: () => void;
}

/**
 * Spotlight tutorial REALTIME — menyorot tombol/menu asli di halaman
 * (bukan slide). Elemen target diberi atribut `data-tutorial-id="..."`.
 *
 * - Cincin sorot mengikuti posisi elemen (ikut scroll/resize, dan mengejar
 *   elemen yang muncul belakangan mis. modal).
 * - Klik pada elemen target → otomatis lanjut ke langkah berikutnya
 *   (aksi asli elemen tetap berjalan: navigasi / buka modal).
 * - Lapisan overlay TIDAK memblokir klik ke halaman (pointer-events none),
 *   hanya kartu petunjuk yang bisa diklik.
 */
export default function TutorialSpotlight({
  active,
  step,
  steps,
  onAdvance,
  onComplete,
  onSkip,
}: TutorialSpotlightProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const finished = step >= steps.length;

  const current: TutorialStep | null = !finished ? steps[step] : null;

  // Ukur posisi elemen target; ikuti scroll/resize + elemen yang muncul
  // belakangan (modal) via interval ringan.
  useLayoutEffect(() => {
    if (!active || !current) {
      setRect(null);
      return;
    }
    let raf = 0;
    const measure = () => {
      const el = document.querySelector<HTMLElement>(
        `[data-tutorial-id="${current.targetId}"]`
      );
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    const iv = setInterval(measure, 600);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      clearInterval(iv);
      cancelAnimationFrame(raf);
    };
  }, [active, current]);

  // Klik pada elemen target → lanjut (aksi asli elemen tetap berjalan).
  useEffect(() => {
    if (!active || !current) return;
    const targetId = current.targetId;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (t && t.closest(`[data-tutorial-id="${targetId}"]`)) {
        onAdvance();
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [active, current, onAdvance]);

  const tooltipStyle = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!rect) {
      return { left: 12, top: 88, width: Math.min(vw - 24, 340) };
    }
    const cardW = Math.min(vw - 24, 340);
    const left = Math.max(
      12,
      Math.min(rect.left + rect.width / 2 - cardW / 2, vw - cardW - 12)
    );
    const below = rect.bottom + 14;
    const placeBelow = rect.bottom + 190 < vh;
    const top = placeBelow ? below : Math.max(12, rect.top - 190);
    return { left, top, width: cardW };
  }, [rect]);

  if (!active) return null;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="tutorial"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-[70]"
        >
          {finished ? (
            /* ── Kartu selesai ── */
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 240, damping: 20 }}
              className="pointer-events-auto absolute left-1/2 top-1/2 w-[min(92vw,380px)] -translate-x-1/2 -translate-y-1/2 rounded-clay-md border-3 border-clay-primary/40 bg-white p-6 text-center shadow-clay-lg"
            >
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-clay-success shadow-clay-btn"
              >
                <PartyPopper size={30} className="text-white" />
              </motion.div>
              <h3 className="mt-4 text-xl font-extrabold">Kamu siap! 🎉</h3>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-clay-muted">
                Sekarang kamu tahu caranya. Pilih sumber materi dan buat
                catatan pertamamu — AI akan membantumu.
              </p>
              <button
                onClick={onComplete}
                className="mt-5 min-h-[44px] w-full rounded-clay-md bg-clay-primary px-5 py-2.5 text-sm font-extrabold text-white shadow-clay-btn transition-all duration-75 hover:-translate-y-0.5 active:translate-y-1"
              >
                Selesai — Mulai Belajar ✨
              </button>
            </motion.div>
          ) : rect && current ? (
            <>
              {/* Cincin sorot + peredupan sekitar (box-shadow raksasa) */}
              <motion.div
                key={current.targetId}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
                className="absolute rounded-2xl border-[3px] border-amber-400"
                style={{
                  left: rect.left - 8,
                  top: rect.top - 8,
                  width: rect.width + 16,
                  height: rect.height + 16,
                  boxShadow: "0 0 0 9999px rgba(15,10,5,0.45)",
                }}
              />
              {/* Denyut halus di sekeliling cincin */}
              <motion.div
                className="absolute rounded-2xl border-2 border-amber-300/70"
                style={{
                  left: rect.left - 14,
                  top: rect.top - 14,
                  width: rect.width + 28,
                  height: rect.height + 28,
                }}
                animate={{ scale: [1, 1.06, 1], opacity: [0.9, 0.3, 0.9] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              />

              {/* Kartu petunjuk */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="pointer-events-auto fixed rounded-clay-md border-2 border-clay-borderLight bg-white p-4 shadow-clay-lg"
                style={tooltipStyle()}
              >
                <button
                  onClick={onSkip}
                  aria-label="Lewati tutorial"
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-clay-muted transition-colors hover:bg-clay-beige hover:text-clay-dark"
                >
                  <X size={14} />
                </button>
                <span className="text-[11px] font-extrabold uppercase tracking-wide text-clay-primary">
                  {current.title}
                </span>
                <p className="mt-1.5 pr-6 text-[13.5px] font-semibold leading-relaxed text-clay-dark">
                  {current.text}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    onClick={onSkip}
                    className="text-xs font-extrabold text-clay-muted underline-offset-2 hover:underline"
                  >
                    Lewati tutorial
                  </button>
                  <button
                    onClick={onAdvance}
                    className="min-h-[38px] rounded-clay-md bg-clay-primary px-4 py-1.5 text-xs font-extrabold text-white shadow-clay-sm transition-all duration-75 hover:-translate-y-0.5 active:translate-y-0.5"
                  >
                    Lanjut →
                  </button>
                </div>
              </motion.div>
            </>
          ) : (
            /* Target belum ditemukan (mis. elemen di halaman lain) — kartu pengganti */
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="pointer-events-auto absolute left-1/2 top-16 w-[min(92vw,340px)] -translate-x-1/2 rounded-clay-md border-2 border-clay-borderLight bg-white p-4 text-center shadow-clay-lg"
            >
              <p className="text-sm font-bold text-clay-dark">
                {current?.text}
              </p>
              <button
                onClick={onAdvance}
                className="mt-3 min-h-[38px] rounded-clay-md bg-clay-primary px-4 py-1.5 text-xs font-extrabold text-white"
              >
                Lanjut →
              </button>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
