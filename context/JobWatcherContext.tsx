"use client";

import { recordFirstNote } from "@/lib/firstNoteGuide";

/**
 * Pemantau job pembuatan catatan yang berjalan di latar belakang.
 *
 * Setiap submit di CreateNoteModal menyimpan jobId ke localStorage
 * (eureka_active_jobs). Provider ini — dipasang di root layout — memantau
 * job-job itu dari SEMUA halaman; saat selesai:
 *  1. notifikasi Ding di aplikasi,
 *  2. notifikasi browser (bila diizinkan; klik → buka catatan),
 *  3. event window "note-ready" agar dashboard refresh daftar catatan.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { toast } from "@yusufceng1z/ding-react";
import { isDashboardV2, v2NotePath } from "@/lib/v2Navigation";
import { playCompletionSound } from "@/lib/notifySound";
import { getUserId } from "@/lib/identity";
import { ensurePushSetup } from "@/lib/push";

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
    const n = new Notification("Catatan selesai dibuat!", {
      body: `“${noteTitle}” sudah siap dipelajari.`,
      tag: `note-ready-${noteId}`,
      icon: "/logo.png",
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
  runningJobs: RunningJobInfo[];
}

const JobWatcherContext = createContext<JobWatcherContextValue>({
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
  const inV2 = isDashboardV2(usePathname());
  const [runningJobs, setRunningJobs] = useState<RunningJobInfo[]>([]);

  const notePath = useCallback((id: string) =>
    inV2 ? v2NotePath(id) : `/dashboard/note/${encodeURIComponent(id)}`, [inV2]);

  const showToast = useCallback(({ title, message, variant, link, linkLabel }: ToastState) => {
    toast[variant](title, {
      description: message,
      action: link ? { label: linkLabel ?? "Buka", onClick: () => router.push(link) } : undefined,
    });
  }, [router]);

  // Daftarkan perangkat untuk Web Push bila izin notifikasi sudah diberikan
  // (menutup celah: user yang kembali ke aplikasi tanpa submit catatan baru).
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      void ensurePushSetup(getUserId());
    }
  }, []);

  // Klik "Lihat" pada toast / notifikasi browser → buka catatan
  useEffect(() => {
    const open = (e: Event) => {
      const detail = (e as CustomEvent<{ noteId?: string }>).detail;
      if (detail?.noteId) router.push(notePath(detail.noteId));
    };
    window.addEventListener("open-note", open);
    return () => window.removeEventListener("open-note", open);
  }, [router, notePath]);

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
          ids.map((id) => apiFetch(`/api/notes/jobs/${encodeURIComponent(id)}`))
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
              title: "Catatan selesai dibuat!",
              message: `“${noteTitle}” sudah siap dipelajari.`,
              variant: "success",
              link: noteId ? notePath(noteId) : undefined,
              linkLabel: "Lihat",
            });
            notifyBrowserNoteReady(noteId, noteTitle);
            if (noteId) {
              recordFirstNote(noteId, job.id);
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
              const errMsg = job.error || "Terjadi kesalahan. Coba buat catatan lagi.";
              showToast({
                title: /sibuk|kuota|quota|rate limit/i.test(errMsg)
                  ? "Server sedang sibuk"
                  : "Gagal merangkum materi",
                message: errMsg,
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
  }, [showToast, notePath]);

  return <JobWatcherContext.Provider value={{ runningJobs }}>{children}</JobWatcherContext.Provider>;
}
