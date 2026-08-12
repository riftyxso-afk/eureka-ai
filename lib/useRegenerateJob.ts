"use client";

/**
 * Hook pemantau job regenerate (bab/catatan) — pola sama seperti polling
 * job pembuatan catatan: POST → 202 { jobId } → poll GET /api/notes/jobs/[id]
 * sampai done/error. Bisa dihentikan lewat POST cancel.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/apiClient";
interface RegenerateState {
  running: boolean;
  percent: number;
  message: string;
  error: string | null;
}

const POLL_MS = 2500;

export function useRegenerateJob() {
  const [state, setState] = useState<RegenerateState>({
    running: false,
    percent: 0,
    message: "",
    error: null,
  });
  const jobIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [stopping, setStopping] = useState(false);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return stopPolling;
  }, [stopPolling]);

  const start = useCallback(
    async (url: string, body?: Record<string, unknown>) => {
      stopPolling();
      setState({ running: true, percent: 2, message: "Menyiapkan AI...", error: null });
      setStopping(false);

      try {
        const res = await apiFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        const data = (await res.json().catch(() => null)) as {
          jobId?: string;
          error?: string;
        } | null;

        if (!res.ok || !data?.jobId) {
          setState({
            running: false,
            percent: 0,
            message: "",
            error: data?.error || "Gagal memulai proses. Coba lagi.",
          });
          return;
        }

        jobIdRef.current = data.jobId;

        const poll = async () => {
          const id = jobIdRef.current;
          if (!id) return;
          try {
            const jres = await apiFetch(`/api/notes/jobs/${encodeURIComponent(id)}`);
            if (jres.status === 404) {
              stopPolling();
              setState({
                running: false,
                percent: 0,
                message: "",
                error:
                  "Proses terhenti karena server sempat restart. Silakan coba lagi.",
              });
              return;
            }
            const jdata = (await jres.json().catch(() => null)) as {
              job?: {
                status: string;
                percent: number;
                message: string;
                error?: string;
                cancelled?: boolean;
              };
            } | null;
            const job = jdata?.job;
            if (!job) return;

            if (job.status === "done") {
              stopPolling();
              setState({
                running: false,
                percent: 100,
                message: job.message || "Selesai!",
                error: null,
              });
              return;
            }
            if (job.status === "error") {
              stopPolling();
              setState({
                running: false,
                percent: 0,
                message: "",
                error:
                  job.error ||
                  (job.cancelled
                    ? "Proses dibatalkan."
                    : "Terjadi kesalahan. Coba lagi."),
              });
              return;
            }
            setState((prev) => ({
              ...prev,
              percent: Math.max(0, Math.min(100, Math.round(job.percent))),
              message: job.message || prev.message,
            }));
          } catch {
            // coba lagi di siklus berikutnya
          }
        };

        await poll();
        timerRef.current = setInterval(poll, POLL_MS);
      } catch {
        setState({
          running: false,
          percent: 0,
          message: "",
          error: "Gagal menghubungi server. Periksa koneksimu.",
        });
      }
    },
    [stopPolling]
  );

  const stop = useCallback(async () => {
    const id = jobIdRef.current;
    if (!id) return;
    setStopping(true);
    try {
      await apiFetch(`/api/notes/jobs/${encodeURIComponent(id)}`, {
        method: "POST",
      });
    } catch {
      // abaikan
    }
    stopPolling();
    setState((prev) => ({ ...prev, running: false }));
    jobIdRef.current = null;
  }, [stopPolling]);

  const reset = useCallback(() => {
    stopPolling();
    jobIdRef.current = null;
    setStopping(false);
    setState({ running: false, percent: 0, message: "", error: null });
  }, [stopPolling]);

  return { ...state, start, stop, reset, stopping };
}
