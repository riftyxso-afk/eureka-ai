"use client";

import { MomoLoadingVideo } from "./MomoLoadingVideo";

interface DreamingOverlayProps {
  open: boolean;
  title?: string;
  status?: string;
  percent?: number;
  onCancel?: () => void;
  cancelDisabled?: boolean;
}

export function DreamingOverlay({
  open,
  title = "Momo sedang menulis ulang catatan",
  status = "Menyiapkan catatan…",
  percent,
  onCancel,
  cancelDisabled,
}: DreamingOverlayProps) {
  if (!open) return null;
  const progress = typeof percent === "number" && Number.isFinite(percent)
    ? Math.min(100, Math.max(0, Math.round(percent)))
    : undefined;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-violet-50 p-4 dark:bg-[#18131e]">
      <section aria-label={title} className="w-full max-w-md rounded-3xl border border-violet-100 bg-white p-6 text-center shadow-sm dark:border-violet-900 dark:bg-[#282130] sm:p-8">
        <MomoLoadingVideo />
        <div role="status" aria-live="polite">
          <h2 className="mt-5 text-xl font-extrabold text-slate-900 dark:text-white">{title}</h2>
          <p className="mt-2 break-words text-sm text-slate-600 dark:text-violet-200">{status}</p>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <progress aria-label={title} max={100} value={progress} className="momo-loading-track" />
          {progress !== undefined && <span className="text-sm font-bold text-violet-700 dark:text-violet-200">{progress}%</span>}
        </div>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={cancelDisabled} className="mt-5 min-h-[44px] rounded-xl border border-red-200 px-4 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-950">
            {cancelDisabled ? "Menghentikan…" : "Hentikan proses"}
          </button>
        )}
      </section>
    </div>
  );
}
