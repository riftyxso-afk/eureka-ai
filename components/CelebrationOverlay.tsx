"use client";

/**
 * CelebrationOverlay — umpan balik gerak untuk momen belajar.
 *
 * Varian:
 *  - answer-correct : jawaban benar (badge hijau memantul)
 *  - answer-wrong   : jawaban salah (getar lembut, tidak menghukum)
 *  - complete       : aktivitas belajar selesai (hujan konfeti singkat)
 *  - milestone      : misi/pencapaian tercapai (ledakan lebih meriah)
 *
 * Aturan (sesuai spec learning-celebrations):
 *  - hanya menganimasikan transform & opacity;
 *  - spring physics, tanpa easing linear;
 *  - hormati prefers-reduced-motion → versi statis tanpa gerak besar;
 *  - TIDAK memblokir interaksi (wrapper pointer-events-none) dan bisa
 *    ditutup lewat tombol kecil atau otomatis selesai.
 */

import { useCallback, useEffect, useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, PartyPopper, Trophy, X } from "lucide-react";

export type CelebrationVariant =
  | "answer-correct"
  | "answer-wrong"
  | "complete"
  | "milestone";

const AUTO_DISMISS_MS: Record<CelebrationVariant, number> = {
  "answer-correct": 1100,
  "answer-wrong": 1100,
  complete: 2300,
  milestone: 2800,
};

/** Warna konfeti dari palet aksen resmi (tier terang — dekoratif). */
const CONFETTI_COLORS = [
  "#0369A1",
  "#7C3AED",
  "#BE123C",
  "#B45309",
  "#047857",
  "#A21CAF",
];

interface CelebrationOverlayProps {
  /** Varian aktif; null = tidak menampilkan apa pun. */
  variant: CelebrationVariant | null;
  /** Perayaan lebih meriah (skor ≥90% / misi naik level). */
  grand?: boolean;
  /** Dipanggil saat overlay selesai (auto atau ditutup). */
  onDone?: () => void;
}

interface Particle {
  x: number; // offset horizontal (vw unit via px calc)
  delay: number;
  size: number;
  color: string;
  rotate: number;
}

export default function CelebrationOverlay({
  variant,
  grand = false,
  onDone,
}: CelebrationOverlayProps) {
  const reduceMotion = useReducedMotion();

  const finish = useCallback(() => onDone?.(), [onDone]);

  useEffect(() => {
    if (!variant) return;
    const t = setTimeout(finish, AUTO_DISMISS_MS[variant]);
    return () => clearTimeout(t);
  }, [variant, finish]);

  // Partikel konfeti stabil per-mount (hindari re-random tiap render).
  const particles = useMemo<Particle[]>(() => {
    const count = variant === "milestone" || grand ? 18 : 10;
    return Array.from({ length: count }, (_, i) => ({
      x: Math.round((i / count) * 100 - 50 + (Math.random() * 8 - 4)),
      delay: Math.random() * 0.25,
      size: 7 + Math.round(Math.random() * 7),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rotate: Math.round(Math.random() * 360),
    }));
  }, [variant, grand]);

  return (
    <AnimatePresence>
      {variant && (
        <div className="pointer-events-none fixed inset-0 z-[75] flex items-center justify-center overflow-hidden">
          {/* Konfeti — hanya untuk complete/milestone */}
          {(variant === "complete" || variant === "milestone") &&
            !reduceMotion &&
            particles.map((p, i) => (
              <motion.span
                key={`p-${i}`}
                initial={{ y: "-8vh", opacity: 0 }}
                animate={{ y: "105vh", opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: grand ? 1.9 : 1.5,
                  delay: p.delay,
                  ease: "easeIn",
                }}
                className="absolute top-0 rounded-sm"
                style={{
                  left: `calc(50% + ${p.x}vw)`,
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                  borderRadius: i % 3 === 0 ? "9999px" : undefined,
                  rotate: `${p.rotate}deg`,
                }}
              />
            ))}

          {/* Badge pusat */}
          {variant === "answer-correct" && (
            <motion.div
              key="correct"
              initial={
                reduceMotion ? { opacity: 0 } : { scale: 0.4, opacity: 0 }
              }
              animate={
                reduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }
              }
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 380, damping: 18 }}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-clay-success text-white shadow-lg"
            >
              <Check size={40} strokeWidth={3.5} />
            </motion.div>
          )}

          {variant === "answer-wrong" && (
            <motion.div
              key="wrong"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 0 }}
              animate={
                reduceMotion
                  ? { opacity: 1 }
                  : { opacity: 1, x: [0, -10, 10, -6, 6, 0] }
              }
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
              className="flex items-center gap-2 rounded-clay-full bg-amber-400 px-5 py-2.5 text-sm font-extrabold text-white shadow-lg"
            >
              <X size={18} strokeWidth={3} /> Belum tepat — semangat!
            </motion.div>
          )}

          {(variant === "complete" || variant === "milestone") && (
            <motion.div
              key={variant}
              initial={
                reduceMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 }
              }
              animate={
                reduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }
              }
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: "spring", stiffness: 260, damping: 17 }}
              className="card-clay relative !rounded-clay flex items-center gap-3 !px-6 !py-4"
            >
              <span
                className={`flex items-center justify-center rounded-full bg-clay-primary/15 text-clay-primary ${
                  grand ? "h-14 w-14" : "h-11 w-11"
                }`}
              >
                {variant === "milestone" ? (
                  <Trophy size={grand ? 28 : 22} />
                ) : (
                  <PartyPopper size={grand ? 28 : 22} />
                )}
              </span>
              <div>
                <p className="text-base font-extrabold leading-tight text-clay-dark">
                  {variant === "milestone"
                    ? grand
                      ? "Luar biasa! Misi besar tercapai!"
                      : "Misi selesai!"
                    : "Aktivitas selesai!"}
                </p>
                <p className="text-xs font-bold text-clay-muted">
                  Kerja bagus, lanjutkan semangatmu 🎉
                </p>
              </div>
              {/* Tombol tutup — satu-satunya area yang menangkap klik */}
              <button
                type="button"
                aria-label="Tutup animasi"
                onClick={finish}
                className="pointer-events-auto absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-clay-beige text-clay-muted shadow-clay-sm"
              >
                <X size={13} />
              </button>
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}
