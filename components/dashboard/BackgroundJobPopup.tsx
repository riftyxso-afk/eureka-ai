"use client";

/**
 * Popup progres pembuatan catatan yang berjalan di latar belakang
 * (dashboard). Menampilkan status realtime dari JobWatcherContext:
 * - Terlipat: pil kecil "Dirangkum di latar belakang ... 45%"
 * - Dibuka: kartu daftar job + progress bar + tombol Berhenti; bisa
 *   disembunyikan (X) & ditampilkan lagi (pil) selama job masih jalan.
 */
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp, FileText, Loader2, Square, X } from "lucide-react";
import { useJobWatcher } from "@/context/JobWatcherContext";

export const BackgroundJobPopup = () => {
  const { runningJobs } = useJobWatcher();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [stoppingIds, setStoppingIds] = useState<string[]>([]);

  useEffect(() => {
    if (runningJobs.length === 0) {
      setExpanded(false);
      setDismissed(false);
      setStoppingIds([]);
    }
  }, [runningJobs.length]);

  const stopJob = async (jobId: string) => {
    setStoppingIds((prev) => (prev.includes(jobId) ? prev : [...prev, jobId]));
    try {
      await apiFetch(`/api/notes/jobs/${encodeURIComponent(jobId)}`, {
        method: "POST",
      });
    } catch {
      setStoppingIds((prev) => prev.filter((id) => id !== jobId));
    }
  };

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
        className="fixed bottom-4 left-4 right-20 z-40 sm:bottom-6 sm:left-6 sm:right-auto"
      >
        {expanded ? (
          <div className="w-full rounded-clay border-3 border-clay-borderLight bg-white shadow-xl sm:w-[320px]">
            <div className="flex items-center justify-between border-b-2 border-clay-shadow/30 px-3 py-3 sm:px-4">
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-clay-primary sm:size-4" />
                <p className="text-xs font-extrabold text-clay-dark sm:text-sm">
                  Dirangkum di Latar Belakang
                </p>
              </div>
              <button
                onClick={() => setDismissed(true)}
                aria-label="Sembunyikan popup"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-clay-muted hover:bg-clay-beige sm:h-7 sm:w-7"
              >
                <X size={18} className="sm:size-[15px]" />
              </button>
            </div>

            <div className="max-h-[260px] space-y-3 overflow-y-auto px-3 py-3 sm:px-4">
              {runningJobs.map((job) => {
                const stopping = stoppingIds.includes(job.id);
                return (
                  <div key={job.id}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-extrabold text-clay-dark sm:gap-2">
                        <FileText size={14} className="shrink-0 text-clay-primary sm:size-[13px]" />
                        <span className="truncate">
                          {stopping ? "Menghentikan..." : job.message}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-extrabold text-clay-muted">
                        {job.percent}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-3 w-full overflow-hidden rounded-clay-full border-2 border-clay-shadow/30 bg-clay-inputBg shadow-clay-inset sm:h-2.5">
                      <motion.div
                        className="h-full rounded-clay-full bg-gradient-to-r from-clay-primary to-clay-accent"
                        initial={{ width: "0%" }}
                        animate={{ width: `${job.percent}%` }}
                        transition={{ type: "spring", stiffness: 110, damping: 22 }}
                      />
                    </div>
                    <button
                      onClick={() => void stopJob(job.id)}
                      disabled={stopping}
                      className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-clay-md border-2 border-red-200 bg-red-50 py-2 text-xs font-extrabold text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Square size={11} className="fill-current" />
                      {stopping ? "Menghentikan..." : "Berhenti"}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="border-t-2 border-clay-shadow/20 px-3 py-2.5 sm:px-4">
              <button
                onClick={() => setExpanded(false)}
                className="w-full rounded-clay-md py-3 text-xs font-extrabold text-clay-muted transition-colors hover:bg-clay-beige hover:text-clay-dark sm:py-1.5"
              >
                Lipat & sembunyikan ↓
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setExpanded(true)}
            aria-label="Lihat progres pembuatan catatan"
            className="flex w-full items-center gap-2 rounded-clay-full border-3 border-clay-borderLight bg-white py-3 pl-4 pr-4 shadow-xl transition-all duration-75 hover:-translate-y-0.5 active:translate-y-1 sm:w-auto sm:gap-3 sm:py-2.5 sm:pl-3.5"
          >
            <Loader2 size={18} className="shrink-0 animate-spin text-clay-primary" />
            <span className="min-w-0 flex-1 text-left sm:flex-initial">
              <span className="block text-xs font-extrabold text-clay-dark">
                Dirangkum di latar belakang
              </span>
              <span className="block truncate text-[11px] font-bold text-clay-muted sm:max-w-[180px]">
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
