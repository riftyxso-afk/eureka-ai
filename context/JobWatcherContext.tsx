"use client";

/**
 * Pemantau job pembuatan catatan yang berjalan di latar belakang.
 *
 * Setiap submit di CreateNoteModal menyimpan jobId ke localStorage
 * (eureka_active_jobs). Provider ini — dipasang di root layout — memantau
 * job-job itu dari SEMUA halaman; saat selesai:
 *  1. toast clay in-app,
 *  2. notifikasi browser (bila diizinkan; klik → buka catatan),
 *  3. event window "note-ready" agar dashboard refresh daftar catatan.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BellRing, CheckCircle2, X, XCircle } from "lucide-react";
import { playCompletionSound } from "@/lib/notifySound";

export const ACTIVE_JOBS_KEY = "eureka_active_jobs";
const POLL_MS = 4000;

export function getActiveJobIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ACTIVE_JOBS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string").slice(0, 10)
      : [];
  } catch {
    return [];
  }
}

export function addActiveJobId(jobId: string): void {
  if (typeof window === "undefined") return;
  try {
    const ids = getActiveJobIds();
    if (!ids.includes(jobId)) {
      window.localStorage.setItem(ACTIVE_JOBS_KEY, JSON.stringify([...ids, jobId]));
    }
  } catch {
    // abaikan
  }
}

export function removeActiveJobId(jobId: string): void {
  if (typeof window === "undefined") return;
  try {
    const ids = getActiveJobIds().filter((id) => id !== jobId);
    window.localStorage.setItem(ACTIVE_JOBS_KEY, JSON.stringify(ids));
  } catch {
    // abaikan
  }
}

export function notifyBrowserNoteReady(noteId: string, noteTitle: string): void {
  if (
    typeof window === "undefined" ||
    typeof Notification === "undefined" ||
    Notification.permission !== "granted"
  ) {
    return;
  }
  try {
    const n = new Notification("Catatan selesai dibuat! 🎉", {
      body: `“${noteTitle}” sudah siap dipelajari.`,
      tag: `note-ready-${noteId}`,
      icon: "/favicon.ico",
    });
    n.onclick = () => {
      window.focus();
      window.dispatchEvent(
        new CustomEvent("open-note", { detail: { noteId } })
      );
      n.close();
    };
  } catch {
    // abaikan — notifikasi opsional
  }
}

interface ToastState {
  title: string;
  message: string;
  variant: "success" | "error" | "info";
  link?: string;
  linkLabel?: string;
}

/** Status realtime sebuah job yang masih berjalan (untuk popup progres). */
export interface RunningJobInfo {
  id: string;
  percent: number;
  message: string;
  cancelled?: boolean;
}

interface JobWatcherContextValue {
  toast: ToastState | null;
  dismissToast: () => void;
  runningJobs: RunningJobInfo[];
}

const JobWatcherContext = createContext<JobWatcherContextValue>({
  toast: null,
  dismissToast: () => {},
  runningJobs: [],
});

export function useJobWatcher(): JobWatcherContextValue {
  return useContext(JobWatcherContext);
}

export function JobWatcherProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [runningJobs, setRunningJobs] = useState<RunningJobInfo[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  const showToast = useCallback(
    (next: ToastState) => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast(next);
      toastTimer.current = setTimeout(() => setToast(null), 7000);
    },
    []
  );

  // Klik "Lihat" pada toast / notifikasi browser → buka catatan
  useEffect(() => {
    const open = (e: Event) => {
      const detail = (e as CustomEvent<{ noteId?: string }>).detail;
      if (detail?.noteId) router.push(`/dashboard/note/${detail.noteId}`);
    };
    window.addEventListener("open-note", open);
    return () => window.removeEventListener("open-note", open);
  }, [router]);

  // Polling job aktif dari localStorage
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const poll = async () => {
      if (cancelled || inFlight) return;
      const ids = getActiveJobIds();
      if (ids.length === 0) return;
      inFlight = true;
      try {
        const results = await Promise.allSettled(
          ids.map((id) => fetch(`/api/notes/jobs/${encodeURIComponent(id)}`))
        );
        for (let i = 0; i < results.length; i++) {
          const res = results[i];
          if (res.status === "rejected" || !res.value.ok) {
            // Job tidak dikenal (server restart / sudah kedaluwarsa) →
            // berhenti memantau dan bersihkan, agar tidak nge-poll 404 terus.
            if (res.status === "fulfilled" && res.value.status === 404) {
              const lost = ids[i];
              removeActiveJobId(lost);
              setRunningJobs((prev) => prev.filter((j) => j.id !== lost));
              showToast({
                title: "Proses terhenti",
                message:
                  "Server sempat restart, jadi pembuatan catatan tidak bisa dilanjutkan. Coba buat lagi ya.",
                variant: "error",
              });
            }
            continue;
          }
          const data = (await res.value.json().catch(() => null)) as {
            job?: {
              id: string;
              status: string;
              percent: number;
              message: string;
              noteId?: string;
              noteTitle?: string;
              error?: string;
              cancelled?: boolean;
            };
          } | null;
          const job = data?.job;
          if (!job) continue;
          if (job.status === "done") {
            removeActiveJobId(job.id);
            setRunningJobs((prev) => prev.filter((j) => j.id !== job.id));
            const noteId = job.noteId ?? "";
            const noteTitle = job.noteTitle ?? "Catatan kamu";
            playCompletionSound();
            showToast({
              title: "Catatan selesai dibuat! 🎉",
              message: `“${noteTitle}” sudah siap dipelajari.`,
              variant: "success",
              link: noteId ? `/dashboard/note/${noteId}` : undefined,
              linkLabel: "Lihat",
            });
            notifyBrowserNoteReady(noteId, noteTitle);
            if (noteId) {
              window.dispatchEvent(
                new CustomEvent("note-ready", { detail: { noteId } })
              );
            }
          } else if (job.status === "error") {
            removeActiveJobId(job.id);
            setRunningJobs((prev) => prev.filter((j) => j.id !== job.id));
            if (job.cancelled) {
              showToast({
                title: "Pembuatan catatan dibatalkan",
                message: "Proses berhenti. Kamu bisa buat catatan lagi kapan saja.",
                variant: "info",
              });
            } else {
              showToast({
                title: "Gagal merangkum materi",
                message: job.error || "Terjadi kesalahan. Coba buat catatan lagi.",
                variant: "error",
              });
            }
          } else {
            // Masih berjalan → simpan status realtime untuk popup progres
            setRunningJobs((prev) => {
              const rest = prev.filter((j) => j.id !== job.id);
              return [
                ...rest,
                {
                  id: job.id,
                  percent: Math.max(0, Math.min(100, Math.round(job.percent))),
                  message: job.message || "Memproses materi...",
                  cancelled: job.cancelled,
                },
              ];
            });
          }
        }
      } catch {
        // jaringan/parsing gagal — coba lagi di siklus berikutnya
      } finally {
        inFlight = false;
      }
    };

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [showToast]);

  return (
    <JobWatcherContext.Provider value={{ toast, dismissToast, runningJobs }}>
      {children}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2"
          >
            <div
              className={`rounded-clay border-3 p-4 shadow-clay-lg ${
                toast.variant === "success"
                  ? "border-clay-borderLight bg-white"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-clay-inset ${
                    toast.variant === "success"
                      ? "bg-clay-success text-white"
                      : "bg-red-100 text-red-500"
                  }`}
                >
                  {toast.variant === "success" ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <XCircle size={18} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-clay-dark">
                    {toast.title}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold leading-relaxed text-clay-muted">
                    {toast.message}
                  </p>
                </div>
                <button
                  onClick={dismissToast}
                  aria-label="Tutup notifikasi"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-clay-muted hover:bg-clay-beige"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between border-t-2 border-clay-shadow/20 pt-3">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-clay-muted">
                  <BellRing size={12} /> Dibuat otomatis oleh AI
                </span>
                {toast.link && (
                  <button
                    onClick={() => {
                      dismissToast();
                      router.push(toast.link!);
                    }}
                    className="inline-flex items-center gap-1 rounded-clay-full bg-clay-primary px-4 py-1.5 text-xs font-extrabold text-white shadow-clay-btn transition-all duration-75 active:translate-y-0.5"
                  >
                    {toast.linkLabel ?? "Buka"}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </JobWatcherContext.Provider>
  );
}
