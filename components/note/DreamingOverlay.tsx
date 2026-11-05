"use client";

import { PageLoader } from "@/components/ui/PageLoader";

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
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/35 p-4">
      <section aria-label={title} className="w-full max-w-md rounded-2xl bg-clay-cream p-5 text-center text-clay-dark sm:p-7">
        <h2 className="text-lg font-extrabold">{title}</h2>
        {progress === undefined ? (
          <PageLoader inline title={status} />
        ) : (
          <div className="mt-4">
            <p role="status" className="break-words text-sm text-clay-muted">{status}</p>
            <div className="mt-3 flex items-center gap-3">
              <progress aria-label={title} max={100} value={progress} className="min-w-0 flex-1 accent-violet-600" />
              <span className="text-sm font-bold tabular-nums">{progress}%</span>
            </div>
          </div>
        )}
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={cancelDisabled} className="mt-5 min-h-[44px] rounded-xl border border-red-200 px-4 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-950">
            {cancelDisabled ? "Menghentikan…" : "Hentikan proses"}
          </button>
        )}
      </section>
    </div>
  );
}
