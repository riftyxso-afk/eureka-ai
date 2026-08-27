"use client";

/**
 * DreamingOverlay — layar "AI sedang bermimpi" saat regenerate/penulisan ulang.
 * Latar gelap gradasi, blob kabur yang mengambang (orbit), partikel berkilau,
 * dan pesan status yang berganti-ganti. Bisa indeterminate (tanpa percent)
 * atau menampilkan progress bar.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Square, Sparkles } from "lucide-react";

interface DreamingOverlayProps {
  open: boolean;
  /** Judul utama di tengah layar (mis. "AI sedang menulis ulang bab..."). */
  title?: string;
  /** Pesan status realtime dari job. Bila kosong, pesan berputar dipakai. */
  status?: string;
  /** 0-100; bila undefined → progress indeterminate (shimmer). */
  percent?: number;
  /** Bila diisi, tampilkan tombol "Berhenti". */
  onCancel?: () => void;
  cancelDisabled?: boolean;
}

const DREAM_MESSAGES = [
  "Membaca ulang catatanmu...",
  "Meramu kata yang tepat...",
  "Memikirkan susunan terbaik...",
  "Menggambar ulang konsep di pikiran...",
  "Memoles kalimat agar makin jelas...",
  "Menyulap materi menjadi catatan impian...",
  "Menata poin-poin penting...",
  "Memastikan tidak ada yang terlewat...",
  "Menyalakan kreativitas AI...",
  "Hampir selesai, sebentar lagi...",
];

const BLOBS = [
  { size: 240, top: "8%", left: "6%", color: "#8B5CF6", delay: 0, duration: 18 },
  { size: 200, top: "58%", left: "70%", color: "#F59E0B", delay: 3, duration: 22 },
  { size: 160, top: "70%", left: "10%", color: "#EC4899", delay: 6, duration: 16 },
  { size: 180, top: "12%", left: "72%", color: "#3B82F6", delay: 9, duration: 20 },
  { size: 120, top: "40%", left: "42%", color: "#A78BFA", delay: 12, duration: 14 },
];

const DREAM_KEYFRAMES = `
@keyframes eureka-dream-orbit {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(24px, -32px) scale(1.08); }
  50% { transform: translate(-18px, 22px) scale(0.94); }
  75% { transform: translate(12px, 18px) scale(1.05); }
}
@keyframes eureka-dream-pulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 0.95; }
}
@keyframes eureka-dream-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(220%); }
}
@keyframes eureka-dream-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
@keyframes eureka-dream-twinkle {
  0%, 100% { opacity: 0.25; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.15); }
}
`;

function getCss(root: Element | null) {
  if (!root) return null;
  const id = "eureka-dream-styles";
  if (root.querySelector(`#${id}`)) return null;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = DREAM_KEYFRAMES;
  root.appendChild(style);
  return style;
}

export function DreamingOverlay({
  open,
  title = "AI sedang menulis ulang...",
  status,
  percent,
  onCancel,
  cancelDisabled,
}: DreamingOverlayProps) {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setMsgIndex(Math.floor(Math.random() * DREAM_MESSAGES.length));
    const t = setInterval(() => {
      setMsgIndex((i) => (i + 1) % DREAM_MESSAGES.length);
    }, 2600);
    return () => clearInterval(t);
  }, [open]);

  useEffect(() => {
    const style = getCss(document.head);
    return () => {
      style?.remove();
    };
  }, []);

  const showPercent = typeof percent === "number";
  const displayStatus = status || DREAM_MESSAGES[msgIndex];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="dreaming-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#1E1B3A] via-[#2A1E4E] to-[#3B2A5E]"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {/* Blob kabur yang mengambang */}
          {BLOBS.map((b, i) => (
            <div
              key={i}
              className="pointer-events-none absolute rounded-full mix-blend-screen blur-3xl"
              style={{
                width: b.size,
                height: b.size,
                top: b.top,
                left: b.left,
                background: `radial-gradient(circle at 35% 35%, ${b.color}, transparent 70%)`,
                animation: `eureka-dream-orbit ${b.duration}s ease-in-out ${b.delay}s infinite, eureka-dream-pulse 5s ease-in-out ${b.delay}s infinite`,
                opacity: 0.5,
              }}
            />
          ))}

          {/* Partikel berkilau */}
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={`spark-${i}`}
              className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-clay-cream"
              style={{
                top: `${(i * 37 + 11) % 92}%`,
                left: `${(i * 53 + 7) % 92}%`,
                animation: `eureka-dream-twinkle ${2.4 + (i % 4) * 0.7}s ease-in-out ${i * 0.23}s infinite`,
              }}
            />
          ))}

          {/* Kartu utama */}
          <motion.div
            initial={{ scale: 0.92, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 10 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            className="relative z-10 mx-4 w-full max-w-md rounded-clay border-3 border-white/15 bg-clay-cream/10 p-8 text-center shadow-clay-lg backdrop-blur-md sm:p-10"
          >
            <div
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-3 border-white/25 bg-clay-cream/10 shadow-clay"
              style={{ animation: "eureka-dream-float 3s ease-in-out infinite" }}
            >
              <Loader2 size={34} className="animate-spin text-clay-secondary" />
            </div>

            <h2
              className="mt-6 text-xl font-extrabold text-white sm:text-2xl"
              style={{ animation: "eureka-dream-float 4s ease-in-out infinite" }}
            >
              {title}
            </h2>

            <p className="mt-3 flex items-center justify-center gap-2 text-sm font-bold text-white/80">
              <Sparkles size={15} className="shrink-0 text-clay-secondary" />
              <span key={displayStatus} className="animate-pulse">
                {displayStatus}
              </span>
            </p>

            {/* Progress bar */}
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs font-extrabold text-white/70">
                <span>{showPercent ? `${Math.round(percent!)}%` : "Mengerjakan..."}</span>
                <span>AI Dreaming</span>
              </div>
              <div className="mt-2 h-4 w-full overflow-hidden rounded-clay-full border-2 border-white/20 bg-black/25">
                {showPercent ? (
                  <motion.div
                    className="h-full rounded-clay-full bg-gradient-to-r from-clay-primary via-clay-secondary to-clay-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.max(0, percent!))}%` }}
                    transition={{ type: "spring", stiffness: 90, damping: 24 }}
                  />
                ) : (
                  <div className="relative h-full overflow-hidden rounded-clay-full bg-gradient-to-r from-clay-primary via-clay-secondary to-clay-primary">
                    <div
                      className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                      style={{ animation: "eureka-dream-shimmer 1.6s ease-in-out infinite" }}
                    />
                  </div>
                )}
              </div>
            </div>

            {onCancel && (
              <button
                onClick={onCancel}
                disabled={cancelDisabled}
                className="mt-7 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-clay-md border-2 border-red-300/60 bg-red-500/20 py-3 text-sm font-extrabold text-red-100 transition-colors hover:bg-red-500/35 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Square size={12} className="fill-current" />
                {cancelDisabled ? "Menghentikan..." : "Berhenti"}
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
