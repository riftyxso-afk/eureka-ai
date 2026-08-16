"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, RefreshCw, WifiOff, X } from "lucide-react";

interface AiErrorPopupProps {
  open: boolean;
  message: string | null;
  onRetry: () => void;
  onClose: () => void;
}

/** Deteksi pesan error karena model/provider AI down (bukan auth/kuota). */
function isModelDown(message: string | null): boolean {
  if (!message) return false;
  return (
    /semua provider ai gagal/i.test(message) ||
    /no available channel/i.test(message) ||
    /quota/i.test(message) ||
    /API error 5\d\d/i.test(message) ||
    /stream berakhir tanpa token/i.test(message) ||
    /timeout/i.test(message)
  );
}

/**
 * Pop-up saat model AI gagal/down — user diberi tahu SECEPATNYA alih-alih
 * menunggu diam-diam. Tampil sebagai kartu clay di tengah layar dengan
 * tombol "Coba lagi" & "Tutup".
 */
export default function AiErrorPopup({
  open,
  message,
  onRetry,
  onClose,
}: AiErrorPopupProps) {
  // Tutup otomatis saat popup dibuka ulang (reset animasi).
  useEffect(() => {
    if (open) return;
  }, [open]);

  const down = isModelDown(message);
  const headline = down
    ? "Model AI sedang sibuk atau tidak tersedia"
    : "Terjadi kendala saat menjawab";

  const detail = down
    ? "Semua provider AI sedang bermasalah atau kehabisan kuota. Tunggu sebentar lalu coba lagi ya — atau pilih kecepatan lain (Kilat/Seimbang/Mendalam) di komposer."
    : (message ?? "Koneksi terputus. Coba lagi sebentar lagi ya.");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="ai-error-popup"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-clay-dark/50 px-5 backdrop-blur-[2px]"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="card-clay w-full max-w-md rounded-clay-lg p-5 shadow-clay-lg sm:p-6"
          >
            <div className="flex items-start gap-3">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-clay-full ${
                  down
                    ? "bg-clay-secondary/15 text-clay-secondary"
                    : "bg-clay-primary/15 text-clay-primary"
                }`}
              >
                {down ? <WifiOff size={22} /> : <AlertTriangle size={22} />}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-extrabold text-clay-dark">
                  {headline}
                </h3>
                <p className="mt-1 text-[13px] font-semibold leading-relaxed text-clay-muted">
                  {detail}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-clay-ghost inline-flex items-center gap-1.5 !min-h-[42px] !px-4 text-sm"
              >
                <X size={15} />
                Tutup
              </button>
              <button
                type="button"
                onClick={onRetry}
                className="btn-clay-primary inline-flex items-center gap-2 !min-h-[42px] !px-5 text-sm"
              >
                <RefreshCw size={15} />
                Coba lagi
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
