"use client";

/**
 * PdfWorkflowModal — modal generate dokumen PDF dengan animasi ALUR KERJA.
 *
 * Membuka koneksi SSE ke /api/notes/:id/pdf/stream lalu menampilkan
 * langkah-langkah realtime (Membaca → Merapikan AI → Python/reportlab →
 * Menulis BAB → Merender). Saat event `done` diterima, PDF (base64)
 * langsung diunduh otomatis.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  CheckCircle2,
  FileText,
  FileWarning,
  Loader2,
  PenLine,
  Printer,
  RefreshCw,
  ServerCog,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { apiUrl } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";

interface WorkflowStep {
  id: number;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  { id: 1, label: "Membaca catatan sebagai referensi", icon: FileText },
  { id: 2, label: "Menyusun dokumen baru dengan AI", icon: Wand2 },
  { id: 3, label: "Menjalankan mesin Python (reportlab)", icon: ServerCog },
  { id: 4, label: "Menulis isi dokumen satu per satu", icon: PenLine },
  { id: 5, label: "Merender & memfinalisasi PDF", icon: Printer },
  { id: 6, label: "PDF siap — unduh otomatis", icon: CheckCircle2 },
];

interface SseProgress {
  percent: number;
  message: string;
  step: number;
}

export function PdfWorkflowModal({
  noteId,
  noteTitle,
  onClose,
  notify,
}: {
  noteId: string;
  noteTitle: string;
  onClose: () => void;
  notify: (msg: string) => void;
}) {
  const [status, setStatus] = useState<"running" | "done" | "error">("running");
  const [progress, setProgress] = useState<SseProgress>({
    percent: 0,
    message: "Menyiapkan...",
    step: 0,
  });
  const [errorMsg, setErrorMsg] = useState("");
  const [savedBase64, setSavedBase64] = useState<string | null>(null);
  const [savedFilename, setSavedFilename] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const abortedRef = useRef(false);
  const doneRef = useRef(false);

  const downloadPdf = useCallback(
    (base64: string, filename: string) => {
      try {
        // Decode base64 ke Blob → unduh otomatis.
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename || `${noteTitle.slice(0, 40)}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch {
        setErrorMsg("Gagal mengunduh PDF — coba lagi.");
        setStatus("error");
      }
    },
    [noteTitle]
  );

  // Coba lagi: tutup koneksi lama, reset state, mulai ulang dari nol.
  const retry = () => {
    abortedRef.current = true;
    doneRef.current = true;
    setStatus("running");
    setErrorMsg("");
    setSavedBase64(null);
    setSavedFilename("");
    setProgress({ percent: 0, message: "Menyiapkan...", step: 0 });
    setRetryKey((k) => k + 1);
  };

  useEffect(() => {
    abortedRef.current = false;
    doneRef.current = false;

    const es = new EventSource(
      apiUrl(
        `/api/notes/${encodeURIComponent(noteId)}/pdf/stream?userId=${encodeURIComponent(
          getUserId()
        )}`
      )
    );

    es.onmessage = (ev) => {
      if (abortedRef.current) return;
      try {
        const data = JSON.parse(ev.data) as SseProgress;
        if (data && typeof data.percent === "number") {
          setProgress({
            percent: data.percent,
            message: data.message || "Bekerja...",
            step: data.step ?? 0,
          });
        }
      } catch {
        // abaikan event tak dikenal
      }
    };

    es.addEventListener("done", (ev) => {
      if (abortedRef.current || doneRef.current) return;
      doneRef.current = true;
      try {
        const data = JSON.parse((ev as MessageEvent).data) as {
          base64?: string;
          filename?: string;
        };
        if (data.base64) {
          setProgress((p) => ({ ...p, percent: 100, step: 6, message: "PDF selesai!" }));
          setSavedBase64(data.base64);
          setSavedFilename(data.filename ?? "");
          setStatus("done");
          downloadPdf(data.base64, data.filename ?? "");
          notify("Dokumen PDF selesai! 📄");
        }
      } catch {
        setErrorMsg("Respons selesai tidak valid.");
        setStatus("error");
      }
      es.close();
    });

    es.addEventListener("error", (ev) => {
      // EventSource memanggil error saat koneksi ditutup server — bedakan
      // dengan error event custom dari server.
      const custom = (ev as MessageEvent & { data?: string }).data;
      if (custom) {
        try {
          const data = JSON.parse(custom) as { error?: string };
          if (data.error) {
            setErrorMsg(data.error);
            setStatus("error");
            es.close();
            return;
          }
        } catch {
          // bukan error JSON — biarkan
        }
      }
      if (abortedRef.current || doneRef.current) return;
      // Koneksi terputus tanpa done → tampilkan opsi coba lagi.
      if (!doneRef.current) {
        setErrorMsg("Koneksi terputus saat menyusun PDF. Coba lagi.");
        setStatus("error");
        es.close();
      }
    });

    return () => {
      abortedRef.current = true;
      es.close();
    };
  }, [noteId, notify, downloadPdf, retryKey]);

  const close = () => {
    abortedRef.current = true;
    onClose();
  };

  const stepState = (stepId: number): "pending" | "active" | "done" => {
    if (status === "done") return "done";
    // Saat gagal: semua langkah tampil pending (abu-abu), tidak ada yang
    // hijau — biar jelas proses tidak selesai.
    if (status === "error") return "pending";
    if (progress.step > stepId) return "done";
    if (progress.step === stepId) return "active";
    return "pending";
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex items-end justify-center overflow-y-auto bg-black/45 p-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:items-center sm:p-4"
        onClick={close}
      >
        <motion.div
          initial={{ y: 32, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 32, opacity: 0, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          className="card-clay m-auto w-full max-w-md overflow-hidden !p-0 !shadow-none"
          style={{ borderRadius: "1.5rem 1.5rem 0 0" }}
        >
          {/* Header dokumen */}
          <div className="relative overflow-hidden bg-gradient-to-br from-clay-primary via-violet-700 to-clay-primary px-5 pb-5 pt-5 sm:px-6">
            <div
              className="pointer-events-none absolute inset-0 opacity-15"
              style={{
                background:
                  "radial-gradient(circle at 85% 20%, rgba(255,255,255,0.7), transparent 45%)",
              }}
            />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <motion.span
                  animate={
                    status === "running"
                      ? { scale: [1, 1.08, 1], rotate: [0, -4, 4, 0] }
                      : { scale: 1, rotate: 0 }
                  }
                  transition={
                    status === "running"
                      ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
                      : {}
                  }
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-clay-lg bg-white/15 text-white shadow-clay-sm"
                >
                  <FileText size={24} />
                </motion.span>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-white sm:text-lg">
                    Menyusun Dokumen PDF
                  </h3>
                  <p className="mt-0.5 truncate text-xs font-bold text-white/70">
                    {noteTitle}
                  </p>
                </div>
              </div>
              <button
                onClick={close}
                aria-label="Tutup"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/15 hover:text-white sm:h-9 sm:w-9"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Isi */}
          <div className="p-5 sm:p-6">
            {/* Langkah-langkah alur kerja */}
            <div className="space-y-2.5">
              {WORKFLOW_STEPS.map((step) => {
                const state = stepState(step.id);
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: step.id * 0.08 }}
                    className={`flex items-center gap-3 rounded-clay-md border-2 px-3 py-2.5 transition-colors duration-300 ${
                      state === "done"
                        ? "border-emerald-300 bg-emerald-50"
                        : state === "active"
                          ? "border-clay-primary bg-clay-primary/10"
                          : "border-clay-shadow/25 bg-white/60 opacity-60"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                        state === "done"
                          ? "bg-emerald-500 text-white"
                          : state === "active"
                            ? "bg-clay-primary text-white"
                            : "bg-clay-beige text-clay-muted"
                      }`}
                    >
                      {state === "done" ? (
                        <Check size={15} strokeWidth={3} />
                      ) : state === "active" ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Icon size={14} />
                      )}
                    </span>
                    <span
                      className={`text-sm font-extrabold ${
                        state === "done"
                          ? "text-emerald-800"
                          : state === "active"
                            ? "text-clay-dark"
                            : "text-clay-muted"
                      }`}
                    >
                      {step.label}
                      {state === "active" && (
                        <span className="block text-[11px] font-bold text-clay-primary/80">
                          {progress.message}
                        </span>
                      )}
                    </span>
                  </motion.div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs font-extrabold">
                <span className="text-clay-muted">
                  {status === "done"
                    ? "Selesai!"
                    : status === "error"
                      ? "Gagal"
                      : progress.message}
                </span>
                <span className="text-clay-primary">{progress.percent}%</span>
              </div>
              <div className="mt-2 h-3.5 w-full overflow-hidden rounded-clay-full border-2 border-clay-shadow/30 bg-clay-inputBg shadow-clay-inset">
                <motion.div
                  className={`h-full rounded-clay-full ${
                    status === "error"
                      ? "bg-red-400"
                      : "bg-gradient-to-r from-clay-primary via-violet-500 to-fuchsia-400"
                  }`}
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress.percent}%` }}
                  transition={{ type: "spring", stiffness: 90, damping: 22 }}
                />
              </div>
            </div>

            {/* Status akhir */}
            <div className="mt-5">
              {status === "running" && (
                <p className="flex items-center gap-2 text-xs font-bold text-clay-muted">
                  <Sparkles size={13} className="text-clay-primary" />
                  Kamu bisa tutup — PDF tetap diproses & diunduh otomatis.
                </p>
              )}
              {status === "done" && (
                <div className="rounded-clay-md border-2 border-emerald-300 bg-emerald-50 p-3.5">
                  <p className="flex items-center gap-2 text-sm font-extrabold text-emerald-800">
                    <CheckCircle2 size={16} />
                    PDF berhasil dibuat!
                  </p>
                  <p className="mt-1 text-xs font-bold text-emerald-700/80">
                    Unduhan dimulai otomatis. Kalau tidak muncul, tekan tombol di
                    bawah.
                  </p>
                  {savedBase64 && (
                    <button
                      onClick={() => downloadPdf(savedBase64, savedFilename)}
                      className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-clay-md bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-clay-sm transition-all duration-75 hover:-translate-y-0.5 active:translate-y-0.5"
                    >
                      <FileText size={15} />
                      Unduh Lagi
                    </button>
                  )}
                </div>
              )}
              {status === "error" && (
                <div className="rounded-clay-md border-2 border-red-200 bg-red-50 p-3.5">
                  <p className="flex items-center gap-2 text-sm font-extrabold text-red-700">
                    <FileWarning size={16} />
                    Dokumen tidak dibuat
                  </p>
                  <p className="mt-1 text-xs font-bold text-red-600/80">{errorMsg}</p>
                  <p className="mt-1.5 text-[11px] font-semibold text-red-500/80">
                    Dokumen hanya disusun oleh AI sungguhan — tanpa AI, PDF
                    sengaja tidak digenerate agar isinya tidak sekadar salinan
                    catatan.
                  </p>
                </div>
              )}
            </div>

            {/* Tombol bawah */}
            <div className="mt-5 flex gap-3">
              {status === "error" ? (
                <>
                  <button
                    onClick={retry}
                    className="btn-clay-primary flex-1 !min-h-[46px] !px-4 text-sm"
                  >
                    <RefreshCw size={15} className="mr-2" />
                    Coba Lagi
                  </button>
                  <button
                    onClick={close}
                    className="btn-clay-ghost flex-1 !min-h-[46px] !px-4 text-sm"
                  >
                    Tutup
                  </button>
                </>
              ) : (
                <button
                  onClick={close}
                  disabled={status === "running"}
                  className="btn-clay-ghost flex-1 !min-h-[46px] !px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {status === "running" ? "Memproses..." : "Selesai"}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
