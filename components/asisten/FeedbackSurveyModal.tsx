"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { markFeedbackDismissedLocally } from "@/lib/assistant/feedback";
import { Heart, Loader2, X } from "lucide-react";
import { SakugaButton, SakugaRating } from "@/components/ui/sakuga";
import { toast } from "@/lib/toast";

/**
 * Survey performa Eureka — sekali per user, ~1 menit setelah catatan pertama
 * selesai. Rating 1-5 wajib saat submit; "Nanti saja" mencatat dismiss
 * permanen di server (tidak akan muncul lagi).
 */
export default function FeedbackSurveyModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [suggestion, setSuggestion] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setRating(0);
      setSuggestion("");
      setSaving(false);
      setError(null);
      setDone(false);
    }
  }, [open]);

  const send = async (payload: {
    rating?: number;
    suggestion?: string;
    dismissed?: boolean;
  }) => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/feedback/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: getUserId(), ...payload }),
      });
      if (res.status === 409) {
        // Sudah pernah diisi di tempat lain — anggap selesai.
        setDone(true);
        setTimeout(onClose, 800);
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Gagal menyimpan jawaban. Coba lagi.");
        return;
      }
      if (payload.rating) toast.success("Masukan tersimpan.");
      setDone(true);
      setTimeout(onClose, 900);
    } catch {
      setError("Gagal terhubung ke server. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  const handleDismiss = () => {
    markFeedbackDismissedLocally();
    void send({ dismissed: true });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 p-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:items-center sm:p-4"
      onClick={handleDismiss}
    >
      <div
        className="card-clay m-auto w-full max-w-md max-h-[80dvh] overflow-y-auto sm:max-h-[85vh] p-3 sm:!p-6 rounded-clay !shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 sm:mb-4 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-extrabold text-clay-dark">
            Bagaimana pengalamanmu dengan Eureka?
          </h2>
          <button
            onClick={handleDismiss}
            disabled={saving}
            aria-label="Tutup"
            className="btn-clay-ghost !min-h-[44px] !px-2.5"
          >
            <X size={16} />
          </button>
        </div>

        {done ? (
          <div className="space-y-3 py-6 text-center">
            <Heart size={40} className="mx-auto text-clay-primary" />
            <p className="text-sm font-extrabold text-clay-dark">
              Terima kasih atas masukannya!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs sm:text-sm font-semibold leading-relaxed text-clay-muted">
              Seberapa puas kamu dengan jawaban Eureka saat membuat catatan?
            </p>

            <div className="flex items-center justify-center gap-1.5 sm:gap-2">
              <SakugaRating label="Kepuasan saat membuat catatan" value={rating} onChange={setRating} disabled={saving} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-clay-muted">
                Saran untuk kami (opsional)
              </label>
              <textarea
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Apa yang bisa Eureka perbaiki?"
                className="w-full resize-none rounded-clay-md border-2 border-clay-borderLight bg-clay-cream px-3 py-2.5 text-sm font-semibold text-clay-dark outline-none focus:border-clay-primary placeholder:text-clay-muted"
              />
            </div>

            {error && (
              <p className="rounded-clay-md border-2 border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600">
                {error}
              </p>
            )}

            <button
              onClick={() => send({ rating, suggestion })}
              disabled={saving || rating === 0}
              className="btn-clay-primary w-full !min-h-[46px] sm:!min-h-[48px] disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  Mengirim...
                </>
              ) : rating === 0 ? (
                "Pilih rating dulu ya!"
              ) : (
                "Kirim Masukan"
              )}
            </button>

            <SakugaButton
              variant="secondary"
              onClick={handleDismiss}
              disabled={saving}
              className="w-full"
            >
              Nanti saja
            </SakugaButton>
          </div>
        )}
      </div>
    </div>
  );
}
