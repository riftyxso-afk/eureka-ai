"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { copyText } from "@/lib/assistant/clipboard";
import { Check, Copy, Link2, Loader2, Share2, X } from "lucide-react";

/**
 * Modal bagikan chat: otomatis membuat snapshot publik saat dibuka,
 * lalu tampilkan link untuk disalin.
 */
export default function ShareModal({
  sessionId,
  title,
  open,
  onClose,
}: {
  sessionId: string;
  title: string;
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  const createShare = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(
        `/api/assistant/sessions/${encodeURIComponent(sessionId)}/share`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: getUserId() }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        token?: string;
        error?: string;
      };
      if (!res.ok || !data.token) {
        setError(data.error ?? "Gagal membuat link share.");
        return;
      }
      setLink(`${window.location.origin}/share/${data.token}`);
    } catch {
      setError("Gagal membuat link share. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  // Buat snapshot otomatis setiap modal dibuka.
  useEffect(() => {
    if (open) {
      setLink("");
      setCopied(false);
      void createShare();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionId]);

  if (!open) return null;

  const handleCopy = async () => {
    if (!link) return;
    const ok = await copyText(link);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 p-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card-clay m-auto w-full max-w-md max-h-[80dvh] overflow-y-auto sm:max-h-[85vh] p-3 sm:!p-6 rounded-clay !shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 sm:mb-4 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-extrabold text-clay-dark">
            Bagikan Chat
          </h2>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="btn-clay-ghost !min-h-[44px] !px-2.5"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <p className="text-xs sm:text-sm font-semibold leading-relaxed text-clay-muted">
            Siapa pun yang punya link ini bisa melihat percakapan{" "}
            <span className="font-extrabold text-clay-dark">{title}</span>{" "}
            tanpa login. Snapshot dibuat saat ini — pesan baru setelahnya tidak
            ikut tampil.
          </p>

          {loading && (
            <div className="flex items-center gap-2 rounded-clay-md border-2 border-clay-shadow/40 bg-clay-beige p-3 text-sm font-bold text-clay-muted">
              <Loader2 size={16} className="animate-spin" />
              Membuat link share…
            </div>
          )}

          {error && (
            <div className="rounded-clay-md border-2 border-red-300 bg-red-50 p-3 text-xs font-bold text-red-600">
              {error}
              <button
                onClick={createShare}
                disabled={loading}
                className="btn-clay-ghost ml-2 !min-h-[32px] !px-2.5 !py-1 text-xs disabled:opacity-50"
              >
                Coba lagi
              </button>
            </div>
          )}

          {!loading && link && (
            <div className="rounded-clay-md border-2 border-clay-shadow/40 bg-clay-beige p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-clay-muted">
                <Link2 size={14} />
                Link publik (hanya lihat)
              </div>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-xl bg-clay-cream px-3 py-2 text-xs font-bold text-clay-dark">
                  {link}
                </code>
                <button
                  onClick={handleCopy}
                  className="btn-clay-ghost shrink-0 !min-h-[44px] !px-3"
                  aria-label="Salin link"
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>
              {copied && (
                <p className="mt-1.5 text-right text-[11px] font-bold text-green-600">
                  Link tersalin!
                </p>
              )}
            </div>
          )}

          <button
            onClick={handleCopy}
            disabled={!link}
            className="btn-clay-primary w-full !min-h-[46px] sm:!min-h-[48px] disabled:opacity-60"
          >
            <Share2 size={18} className="mr-2" />
            Salin link share
          </button>
        </div>
      </div>
    </div>
  );
}
