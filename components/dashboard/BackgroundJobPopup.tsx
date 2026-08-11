"use client";

/**
 * Popup progres pembuatan catatan yang berjalan di latar belakang
 * (dashboard). Menampilkan status realtime dari JobWatcherContext:
 * - Terlipat: pil kecil "Dirangkum di latar belakang ... 45%"
 * - Dibuka: kartu daftar job + progress bar; bisa disembunyikan (X) &
 *   ditampilkan lagi (pil) selama job masih jalan.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp, FileText, Loader2, X } from "lucide-react";
import { useJobWatcher } from "@/context/JobWatcherContext";

export const BackgroundJobPopup = () => {
  const { runningJobs } = useJobWatcher();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Saat tidak ada job sama sekali → kembalikan ke keadaan awal
  // (sembunyian dibuka lagi bila ada job baru).
  useEffect(() => {
    if (runningJobs.length === 0) {
      setExpanded(false);
      setDismissed(false);
    }
  }, [runningJobs.length]);

  if (runningJobs.length === 0 || dismissed) return null;

  const topPercent = Math.max(...runningJobs.map((j) => j.percent));
  const topJob = runningJobs.reduce((a, b) => (a.percent >= b.percent ? a : b));

  return (
    <AnimatePresence>
      <motion.div
        key="bg-job-popup"
        initial={{ opacity: 0, y: 24, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="fixed bottom-6 left-6 z-40"
      >
        {expanded ? (
          <div className="w-[320px] rounded-clay border-3 border-clay-borderLight bg-white shadow-clay-lg">
            <div className="flex items-center justify-between border-b-2 border-clay-shadow/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-clay-primary" />
                <p className="text-sm font-extrabold text-clay-dark">
                  Dirangkum di Latar Belakang
                </p>
              </div>
              <button
                onClick={() => setDismissed(true)}
                aria-label="Sembunyikan popup"
                className="flex h-7 w-7 items-center justify-center rounded-full text-clay-muted hover:bg-clay-beige"
              >
                <X size={15} />
              </button>
            </div>

            <div className="max-h-[260px] space-y-3 overflow-y-auto px-4 py-3">
              {runningJobs.map((job) => (
                <div key={job.id}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-extrabold text-clay-dark">
                      <FileText size={13} className="shrink-0 text-clay-primary" />
                      <span className="truncate">{job.message}</span>
                    </span>
                    <span className="shrink-0 text-xs font-extrabold text-clay-muted">
                      {job.percent}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-clay-full border-2 border-clay-shadow/30 bg-clay-inputBg shadow-clay-inset">
                    <motion.div
                      className="h-full rounded-clay-full bg-gradient-to-r from-clay-primary to-clay-accent"
                      initial={{ width: "0%" }}
                      animate={{ width: `${job.percent}%` }}
                      transition={{ type: "spring", stiffness: 110, damping: 22 }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t-2 border-clay-shadow/20 px-4 py-2.5">
              <button
                onClick={() => setExpanded(false)}
                className="w-full rounded-clay-md py-1.5 text-xs font-extrabold text-clay-muted transition-colors hover:bg-clay-beige hover:text-clay-dark"
              >
                Lipat & sembunyikan ↓
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setExpanded(true)}
            aria-label="Lihat progres pembuatan catatan"
            className="flex items-center gap-3 rounded-clay-full border-3 border-clay-borderLight bg-white py-2.5 pl-3.5 pr-4 shadow-clay-lg transition-all duration-75 hover:-translate-y-0.5 active:translate-y-1"
          >
            <Loader2 size={18} className="shrink-0 animate-spin text-clay-primary" />
            <span className="text-left">
              <span className="block text-xs font-extrabold text-clay-dark">
                Dirangkum di latar belakang
              </span>
              <span className="block max-w-[180px] truncate text-[11px] font-bold text-clay-muted">
                {topJob.message} · {topPercent}%
              </span>
            </span>
            <ChevronUp size={15} className="shrink-0 text-clay-muted" />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
