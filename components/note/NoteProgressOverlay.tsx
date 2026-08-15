"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Square, X } from "lucide-react";
import { apiFetch, apiEventSource } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { detectNoteIntent } from "@/lib/assistant/noteIntent";
import type { NoteCreatePrefs } from "@/components/note/NoteCreateWizard";

interface NoteProgressOverlayProps {
  open: boolean;
  /** Prompt asli user (mis. "buat catatan tentang turunan" / "...dari URL"). */
  prompt: string;
  /** Preferensi dari wizard (jenis catatan, jumlah bab, detail). Opsional. */
  prefs?: NoteCreatePrefs;
  onClose: () => void;
}

/**
 * Overlay layar penuh saat user meminta "buat catatan" dari prompt chat.
 * Langsung memanggil /api/notes/process (auto-generate AI) dan menampilkan
 * progress 0-100% (SSE + polling). Setelah jadi → buka halaman catatan.
 */
export function NoteProgressOverlay({
  open,
  prompt,
  prefs,
  onClose,
}: NoteProgressOverlayProps) {
  const router = useRouter();
  const [percent, setPercent] = useState(0);
  const [message, setMessage] = useState("Menyiapkan materi…");
  const [error, setError] = useState<string | null>(null);
  const [upgradeUrl, setUpgradeUrl] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const startedRef = useRef(false);
  const jobIdRef = useRef<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);
  const percentRef = useRef(0);

  const cleanup = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  const completeFromJob = useCallback(
    async (jobId: string) => {
      if (doneRef.current) return;
      try {
        const jres = await apiFetch(`/api/notes/jobs/${encodeURIComponent(jobId)}`);
        if (jres.status === 404) {
          doneRef.current = true;
          cleanup();
          setError("Proses terhenti (server restart). Silakan coba lagi.");
          return;
        }
        const jdata = await jres.json();
        const job = jdata?.job;
        if (!job) return;
        if (job.status === "error") {
          doneRef.current = true;
          cleanup();
          setError(job.error || "Gagal membuat catatan. Coba lagi.");
          return;
        }
        if (job.status !== "done" || !job.noteId) return; // belum selesai
        doneRef.current = true;
        cleanup();
        // Selesai → buka halaman catatan yang baru dibuat.
        router.push(`/dashboard/note/${job.noteId}`);
      } catch {
        // ulangi pada panggilan berikutnya (polling/SSE)
      }
    },
    [cleanup, router]
  );

  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      doneRef.current = false;
      setError(null);
      setPercent(0);
      percentRef.current = 0;
      setMessage("Menyiapkan materi…");
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    const intent = detectNoteIntent(prompt);
    const sessionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const form = new FormData();
    form.append(
      "sourceType",
      intent.isYoutube ? "youtube" : intent.url ? "web" : "dokumen"
    );
    if (intent.url) {
      form.append("url", intent.url);
    } else {
      // Tanpa URL: buat file teks dari topik prompt → AI menyusun catatan.
      form.append(
        "file",
        new File([intent.topic || prompt], "catatan.txt", {
          type: "text/plain",
        })
      );
    }
    form.append("studyMode", prefs?.studyMode ?? "standar");
    form.append(
      "generationMode",
      prefs?.generationMode ?? "cepat" // ±1-2 menit, langsung inti
    );
    form.append("gayaPenulisan", "Ramah & Santai");
    form.append("bahasa", "Bahasa Indonesia");
    form.append("chapterCount", String(prefs?.chapterCount ?? 3));
    form.append("noteType", prefs?.noteType ?? "rangkuman");
    form.append("userId", getUserId());
    form.append("sessionId", sessionId);

    // Progress realtime via SSE.
    const es = apiEventSource(`/api/notes/process-progress/${sessionId}`);
    esRef.current = es;
    let jobId = "";
    es.onmessage = (ev) => {
      try {
        const p = JSON.parse(ev.data) as {
          percent?: number;
          message?: string;
        };
        if (typeof p.percent === "number") {
          percentRef.current = Math.max(percentRef.current, p.percent);
          setPercent(percentRef.current);
        }
        if (p.message) setMessage(p.message);
        if (p.percent != null && p.percent >= 100 && jobId) {
          void completeFromJob(jobId);
        }
      } catch {
        // event bukan JSON — abaikan
      }
    };

    (async () => {
      try {
        const res = await apiFetch("/api/notes/process", {
          method: "POST",
          body: form,
          headers: { "x-session-id": sessionId },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const err = new Error(data?.error || "Gagal memulai pembuatan catatan.");
          (err as Error & { upgradeUrl?: string }).upgradeUrl = data?.upgradeUrl;
          throw err;
        }
        if (data?.jobId) {
          jobId = String(data.jobId);
          jobIdRef.current = jobId;
          void completeFromJob(jobId);
          // Jaring pengaman: polling tiap 5 detik bila SSE terblokir.
          pollRef.current = setInterval(() => {
            const cur = jobIdRef.current;
            if (!cur) return;
            void (async () => {
              try {
                const jres = await apiFetch(`/api/notes/jobs/${encodeURIComponent(cur)}`);
                if (jres.status === 404) {
                  void completeFromJob(cur);
                  return;
                }
                const jdata = await jres.json();
                const job = jdata?.job;
                if (!job) return;
                if (
                  typeof job.percent === "number" &&
                  job.percent > percentRef.current
                ) {
                  percentRef.current = job.percent;
                  setPercent(job.percent);
                }
                if (typeof job.message === "string" && job.message) {
                  setMessage(job.message);
                }
                if (job.status === "done" || job.status === "error") {
                  void completeFromJob(cur);
                }
              } catch {
                // abaikan
              }
            })();
          }, 5000);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Terjadi kesalahan.");
        if (e instanceof Error && (e as Error & { upgradeUrl?: string }).upgradeUrl) {
          setUpgradeUrl((e as Error & { upgradeUrl?: string }).upgradeUrl ?? null);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const cancelJob = async () => {
    const id = jobIdRef.current;
    setCancelling(true);
    if (id) {
      try {
        await apiFetch(`/api/notes/jobs/${encodeURIComponent(id)}`, {
          method: "POST",
        });
      } catch {
        // abaikan
      }
    }
    cleanup();
    onClose();
    setCancelling(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="note-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-clay-beige px-6"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="w-full max-w-md rounded-clay-md border-2 border-clay-borderLight bg-white p-6 shadow-clay-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-clay-dark">
                  {error ? "Ups, gagal 😢" : "Membuat catatanmu…"}
                </h2>
                <p className="mt-1 text-xs font-bold text-clay-muted">
                  Eureka sedang menyusun materi —
                  {prefs?.generationMode === "lengkap" ? " ±3-6 menit" : " ±1-2 menit"}
                </p>
              </div>
              <button
                onClick={cancelJob}
                disabled={cancelling}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-clay-beige text-clay-muted shadow-clay-inset transition-colors hover:text-red-500"
                aria-label="Batalkan"
              >
                <X size={16} />
              </button>
            </div>

            {error ? (
              <div className="mt-4 rounded-clay-md border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                {error}
              </div>
            ) : (
              <>
                {/* Progress bar */}
                <div className="mt-5 h-3 w-full overflow-hidden rounded-full bg-clay-beige shadow-clay-inset">
                  <motion.div
                    className="h-full rounded-full bg-clay-primary"
                    animate={{ width: `${Math.max(3, Math.min(100, percent))}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 22 }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-clay-muted">
                    {message}
                  </span>
                  <span className="text-xs font-extrabold text-clay-primary">
                    {Math.round(percent)}%
                  </span>
                </div>

                {/* Langkah pipeline */}
                <div className="mt-4 flex items-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-[3px] border-clay-primary/30 border-t-clay-primary" />
                  <p className="text-[11px] font-bold text-clay-muted">
                    Kamu boleh lanjut menjelajah — notifikasi muncul saat
                    catatan siap
                  </p>
                </div>
              </>
            )}

            {error && upgradeUrl && (
              <a
                href={upgradeUrl}
                className="btn-clay-primary mt-4 block w-full !py-2.5 text-center text-sm"
              >
                👑 Upgrade ke Pro
              </a>
            )}
            {error && (
              <button
                onClick={() => {
                  setError(null);
                  onClose();
                }}
                className="btn-clay-primary mt-4 w-full !py-2.5 text-sm"
              >
                Tutup
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
