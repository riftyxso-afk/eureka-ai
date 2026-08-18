"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface PageLoaderProps {
  /** Judul utama yang tampil di kartu (opsional). */
  title?: string;
}

/** Pesan berganti seiring lama loading — makin lama makin menghibur. */
const MESSAGES = [
  "Memuat halaman...",
  "Masih menyiapkan semuanya...",
  "Koneksi agak lambat — tunggu sebentar ya...",
  "Terima kasih sudah sabar, hampir selesai...",
];

const MESSAGE_AT_MS = [0, 2500, 5000, 9000];

/**
 * Layar loading penuh: logo + progress bar shimmer yang mengisi perlahan
 * + pesan status yang berubah berdasarkan lama menunggu.
 */
export function PageLoader({ title }: PageLoaderProps) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const timers = MESSAGE_AT_MS.slice(1).map((ms, i) =>
      setTimeout(() => setIdx((cur) => Math.max(cur, i + 1)), ms)
    );
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const message = MESSAGES[idx];

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-clay-beige px-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
        className="w-full max-w-sm rounded-clay border-3 border-clay-borderLight bg-white p-8 text-center shadow-clay-lg"
      >
        <div className="relative mx-auto h-28 w-28">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/holo-sticker.gif"
            alt="Logo Eureka.AI"
            style={{ mixBlendMode: "screen" }}
            className="relative h-28 w-28 object-contain"
          />
        </div>

        {title && (
          <h2 className="mt-4 text-lg font-extrabold text-clay-dark sm:text-xl">
            {title}
          </h2>
        )}

        {/* Progress bar yang mengisi perlahan + kilau bergerak */}
        <div className="mt-6 h-4 w-full overflow-hidden rounded-clay-full border-2 border-clay-borderLight bg-clay-inputBg shadow-clay-inset">
          <motion.div
            className="relative h-full overflow-hidden rounded-clay-full bg-gradient-to-r from-clay-primary via-clay-secondary to-clay-primary"
            initial={{ width: "8%" }}
            animate={{ width: "90%" }}
            transition={{ duration: 9, ease: "easeInOut" }}
          >
            <motion.div
              className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/60 to-transparent"
              animate={{ x: ["-100%", "300%"] }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.div>
        </div>

        <AnimatePresence mode="wait">
          <motion.p
            key={message}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="mt-4 flex items-center justify-center gap-1.5 text-sm font-bold text-clay-muted"
          >
            <Sparkles size={14} className="shrink-0 text-clay-primary" />
            {message}
          </motion.p>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
