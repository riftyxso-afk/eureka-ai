"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { History, RotateCcw, X } from "lucide-react";

interface NoteVersion {
  version: number;
  title: string;
  summary: string;
  changedBy: string;
  createdAt: string;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function VersionModal({
  noteId,
  notify,
  onClose,
  onRestored,
}: {
  noteId: string;
  notify: (msg: string) => void;
  onClose: () => void;
  onRestored: () => void;
}) {
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [restoring, setRestoring] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`/api/notes/${noteId}/versions`);
        if (res.ok) {
          const data = await res.json();
          setVersions(data.versions ?? []);
        }
      } catch {
        // abaikan
      }
    })();
  }, [noteId]);

  const handleRestore = async (version: number) => {
    setRestoring(version);
    try {
      const res = await apiFetch(`/api/notes/${noteId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", version }),
      });
      if (res.ok) {
        notify(`Catatan dipulihkan ke versi ${version} âœ…`);
        onRestored();
      } else {
        const err = await res.json().catch(() => ({}));
        notify(err.error ?? "Gagal memulihkan âš ï¸");
      }
    } catch {
      notify("Gagal memulihkan âš ï¸");
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 pb-[max(12px,env(safe-area-inset-bottom))] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card-clay m-auto w-full max-w-md max-h-[85vh] overflow-y-auto p-3 sm:!p-6 rounded-t-clay sm:rounded-clay"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 sm:mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={18} className="text-clay-primary" />
            <h2 className="text-base sm:text-lg font-extrabold text-clay-dark">
              Riwayat Versi
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="btn-clay-ghost !min-h-[44px] !px-2.5"
          >
            <X size={16} />
          </button>
        </div>

        {versions.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-clay-shadow/40 p-5 text-center text-sm font-semibold text-clay-muted">
            Belum ada versi tersimpan. Edit judul catatan untuk membuat versi
            pertama.
          </p>
        ) : (
          <ul className="space-y-3">
            {versions.map((v) => (
              <li
                key={v.version}
                className="rounded-2xl border-2 border-clay-shadow/40 bg-white/60 p-4"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-extrabold text-clay-primary">
                    v{v.version}
                  </span>
                  <span className="text-xs font-semibold text-clay-muted">
                    {formatDateTime(v.createdAt)}
                  </span>
                </div>
                <div className="truncate text-sm font-extrabold text-clay-dark">
                  {v.title}
                </div>
                {v.summary && (
                  <div className="mt-1 line-clamp-2 text-xs font-medium text-clay-muted">
                    {v.summary}
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-clay-muted">
                    oleh {v.changedBy}
                  </span>
                  <button
                    onClick={() => handleRestore(v.version)}
                    disabled={restoring === v.version}
                    className="btn-clay-ghost !min-h-[44px] !px-3 text-xs disabled:opacity-60"
                  >
                    <RotateCcw size={13} className="mr-1.5" />
                    {restoring === v.version ? "Memulihkan..." : "Pulihkan"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
