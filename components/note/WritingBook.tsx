"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PenLine } from "lucide-react";

/** Baris tulisan per halaman buku. */
const LINES_PER_PAGE = 5;
/** Perkiraan jumlah karakter yang mengisi satu halaman. */
const TOKENS_PER_PAGE = 600;
/** Maks halaman sebelum berhenti (soal tidak akan lebih dari 15). */
const MAX_PAGES = 8;

/**
 * Lintasan garis bergelombang seperti tulisan tangan (pathLength
 * dinormalisasi ke 100). Punya 7 lengkung per baris — waveY() di bawah
 * disinkronkan dengan pola ini agar pena menempel di gelombang.
 */
const WAVY_PATH =
  "M0,9 C8,3 16,15 24,9 S40,15 48,9 S64,15 72,9 S88,15 96,9 S104,3 112,9 S120,15 128,9 S136,15 144,9 S152,3 160,9 S168,15 176,9";

/** Posisi vertikal gelombang tulisan (0–100% tinggi baris). */
const waveY = (p: number) => 50 + 33.3 * Math.sin(Math.PI * 7 * p);

/** Pena dengan ujung (nib) di kiri-bawah — goyang pelan seperti menulis. */
function Pen() {
  return (
    <motion.div
      className="pointer-events-none absolute z-10"
      style={{ x: "-21%", y: "-92%", transformOrigin: "21% 92%" }}
      animate={{ rotate: [-18, -6, -18] }}
      transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
    >
      <svg width="24" height="30" viewBox="0 0 24 30" className="drop-shadow-md">
        {/* badan pena */}
        <path
          d="M5 27 L17 15 L13 11 L1 23 L5 27 Z"
          fill="#7B42F5"
          stroke="#4C1D95"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
        {/* sisi terang */}
        <path d="M5 27 L17 15 L13 11 Z" fill="#A78BFA" opacity="0.45" />
        {/* ujung pena */}
        <path d="M5 27 L3.1 28.7 L6.3 27.7 Z" fill="#4C1D95" />
      </svg>
    </motion.div>
  );
}

export default function WritingBook({ tokens }: { tokens: number }) {
  const pageIndex = Math.min(
    Math.floor(tokens / TOKENS_PER_PAGE),
    MAX_PAGES - 1
  );
  const tokensOnPage = tokens - pageIndex * TOKENS_PER_PAGE;
  const perLine = TOKENS_PER_PAGE / LINES_PER_PAGE;

  // Fill 0..1 untuk tiap baris di halaman ini.
  const lineFills = Array.from({ length: LINES_PER_PAGE }, (_, i) =>
    Math.min(Math.max((tokensOnPage - i * perLine) / perLine, 0), 1)
  );

  // Baris yang sedang ditulis (fill < 1) → posisi pena di dalam baris itu.
  const activeLineIdx = lineFills.findIndex((f) => f < 1);
  const penProgress = activeLineIdx >= 0 ? lineFills[activeLineIdx] : 1;
  const penLine = activeLineIdx >= 0 ? activeLineIdx : LINES_PER_PAGE - 1;

  return (
    <div className="select-none">
      {/* Judul + indikator halaman */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-extrabold text-clay-dark">
          <PenLine size={16} className="animate-pulse text-clay-primary" />
          AI sedang menulis soal di buku belajarmu...
        </p>
        <span className="rounded-clay-full bg-clay-beige px-3 py-1 text-xs font-extrabold text-clay-muted shadow-clay-inset">
          Halaman {pageIndex + 1}
        </span>
      </div>

      {/* Buku */}
      <div className="[perspective:1400px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={pageIndex}
            initial={{ rotateY: 140, opacity: 0.5, transformOrigin: "0% 50%" }}
            animate={{ rotateY: 0, opacity: 1, transformOrigin: "0% 50%" }}
            exit={{ rotateY: -140, opacity: 0.4, transformOrigin: "0% 50%" }}
            transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
            className="relative overflow-hidden rounded-clay-md border-3 border-clay-shadow/40 bg-[#FFFDF5] p-5 shadow-clay-sm sm:p-7"
            style={{ backfaceVisibility: "hidden" }}
          >
            {/* Garis margin kiri (seperti buku tulis) */}
            <div className="absolute bottom-0 left-6 top-0 w-0.5 bg-red-200/70 sm:left-8" />
            {/* Garis baris buku tulis (garis halus di belakang tulisan) */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 top-0">
              {Array.from({ length: LINES_PER_PAGE + 1 }, (_, i) => (
                <div
                  key={i}
                  className="absolute inset-x-0 border-t border-sky-200/60"
                  style={{ top: `${(i / (LINES_PER_PAGE + 1)) * 100}%` }}
                />
              ))}
            </div>

            {/* Tulisan tangan per baris + pena di baris aktif.
                pr di kanan agar pena di ujung baris tidak terpotong overflow-hidden. */}
            <div className="relative space-y-4 pr-5 sm:space-y-5 sm:pr-7">
              {lineFills.map((fill, i) => (
                <div key={i} className="relative h-5 sm:h-6">
                  <svg
                    viewBox="0 0 176 18"
                    preserveAspectRatio="none"
                    className="h-full w-full"
                  >
                    <path
                      d={WAVY_PATH}
                      fill="none"
                      stroke="#5B21B6"
                      strokeWidth={2.2}
                      strokeLinecap="round"
                      pathLength={100}
                      strokeDasharray={100}
                      strokeDashoffset={100 - fill * 100}
                      style={{
                        transition: "stroke-dashoffset 0.18s linear",
                        opacity: fill > 0 ? 0.75 : 0,
                      }}
                    />
                  </svg>

                  {/* Pena menempel di baris aktif, ujungnya di titik tulis */}
                  {i === penLine && (
                    <div
                      className="pointer-events-none absolute z-10"
                      style={{
                        left: `${penProgress * 100}%`,
                        top: `${waveY(penProgress)}%`,
                        transition: "left 0.18s linear, top 0.18s linear",
                      }}
                    >
                      <Pen />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
