"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Copy,
  Crown,
  Gift,
  Loader2,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";

interface RefStatus {
  code: string;
  count: number;
  goal: number;
  rewarded: boolean;
  link: string;
}

interface ReferralPopupProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Popup "Bagikan Link (Referral)" — ditampilkan dari sidebar.
 * Isi:
 *  - progres rujukan (x/5) + bar progres
 *  - link referral + tombol salin/bagikan
 *  - tombol "Klaim Premium 30 Hari" bila 5 rujukan valid tercapai
 *    (belum pernah diklaim); status "sudah diklaim" bila rewarded.
 */
export function ReferralPopup({ open, onClose }: ReferralPopupProps) {
  const [status, setStatus] = useState<RefStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const userId = getUserId();
      const res = await apiFetch(
        `/api/referral?userId=${encodeURIComponent(userId)}`
      );
      if (res.ok) {
        const data = (await res.json()) as RefStatus;
        if (data?.code) setStatus(data);
      }
    } catch {
      // tabel referral belum ada / gagal → sembunyikan detail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setStatus(null);
      void load();
    }
  }, [open, load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const copyLink = async () => {
    if (!status) return;
    try {
      await navigator.clipboard.writeText(status.link);
      setToast("Link referral disalin!");
    } catch {
      setToast("Gagal menyalin link");
    }
  };

  const shareLink = async () => {
    if (!status) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Ajak teman belajar di Eureka.AI",
          text: "Daftar lewat link ini — ajak 5 teman, dapatkan Premium 30 hari!",
          url: status.link,
        });
      } else {
        await copyLink();
      }
    } catch {
      // dibatalkan user
    }
  };

  const claim = async () => {
    if (!status || claiming) return;
    setClaiming(true);
    try {
      const userId = getUserId();
      const res = await apiFetch("/api/referral/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok) {
        setToast(data?.error ?? "Gagal klaim reward");
        return;
      }
      setToast("Premium 30 hari berhasil diklaim!");
      await load();
    } catch {
      setToast("Gagal klaim reward");
    } finally {
      setClaiming(false);
    }
  };

  const count = status?.count ?? 0;
  const goal = status?.goal ?? 5;
  const rewarded = status?.rewarded === true;
  const canClaim = !!status && count >= goal && !rewarded;
  const pct = Math.min(Math.round((count / goal) * 100), 100);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 20 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="relative bg-gradient-to-br from-clay-primary via-clay-secondary to-amber-500 px-6 pb-7 pt-6 text-center">
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <Gift
                  size={22}
                  className="absolute left-4 top-3 opacity-40"
                />
                <Sparkles
                  size={20}
                  className="absolute right-5 top-5 opacity-40"
                />
                <Sparkles
                  size={20}
                  className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-40"
                />
              </div>
              <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/20 ring-4 ring-white/30">
                <Gift size={26} className="text-white" />
              </div>
              <h2 className="relative mt-3 text-xl font-extrabold text-white drop-shadow">
                Ajak Teman, Dapat Premium!
              </h2>
              <p className="relative mt-1 text-xs font-bold text-white/90">
                Bagikan link kamu — setiap teman yang mendaftar lewat link
                dihitung. 5 rujukan valid = Premium 30 hari (sekali pakai).
              </p>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              {/* Progres */}
              <div className="rounded-clay-md bg-clay-beige/60 px-4 py-3">
                <div className="flex items-center justify-between text-xs font-extrabold text-clay-muted">
                  <span className="flex items-center gap-1.5">
                    <UsersIcon /> Rujukan valid: {count}/{goal}
                  </span>
                  <span>{pct}%</span>
                </div>
                <div className="mt-2 h-3 w-full overflow-hidden rounded-clay-full bg-clay-shadow/25">
                  <div
                    className="h-full rounded-clay-full bg-gradient-to-r from-clay-primary to-clay-secondary transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Status / tombol klaim */}
              {loading ? (
                <div className="mt-4 flex justify-center py-2 text-clay-muted">
                  <Loader2 size={20} className="animate-spin" />
                </div>
              ) : rewarded ? (
                <div className="mt-4 flex items-center gap-2 rounded-clay-md border-2 border-clay-success/40 bg-clay-success/10 px-4 py-3 text-sm font-extrabold text-clay-success">
                  <CheckCircle2 size={18} className="shrink-0" />
                  Premium 30 hari sudah aktif — terima kasih sudah mengajak
                  teman!
                </div>
              ) : canClaim ? (
                <button
                  onClick={() => void claim()}
                  disabled={claiming}
                  className="btn-clay-primary mt-4 w-full !min-h-[52px]"
                >
                  {claiming ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin" />
                      Mengklaim…
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Crown size={18} /> Klaim Premium 30 Hari
                    </span>
                  )}
                </button>
              ) : (
                <p className="mt-4 flex items-center gap-2 rounded-clay-md bg-clay-primary/5 px-4 py-3 text-xs font-bold text-clay-muted">
                  <Sparkles size={15} className="shrink-0 text-clay-primary" />
                  Klaim premium tersedia setelah {goal} teman mendaftar lewat
                  link kamu (kurang {Math.max(goal - count, 0)} lagi).
                </p>
              )}

              {/* Link + aksi */}
              <div className="mt-4 flex items-center gap-2">
                <div className="min-w-0 flex-1 rounded-clay-md border-2 border-clay-shadow/40 bg-clay-inputBg px-3 py-2.5 text-xs font-bold text-clay-dark">
                  {status ? (
                    <span className="block truncate">{status.link}</span>
                  ) : (
                    "Memuat link…"
                  )}
                </div>
                <button
                  onClick={() => void copyLink()}
                  disabled={!status}
                  aria-label="Salin link referral"
                  title="Salin link"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-clay-md border-2 border-clay-primary bg-clay-primary text-white transition-all duration-75 active:translate-y-0.5 disabled:opacity-50"
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={() => void shareLink()}
                  disabled={!status}
                  aria-label="Bagikan link referral"
                  title="Bagikan"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-clay-md border-2 border-clay-primary bg-clay-primary text-white transition-all duration-75 active:translate-y-0.5 disabled:opacity-50"
                >
                  <Share2 size={16} />
                </button>
              </div>
            </div>

            {/* Tutup */}
            <button
              onClick={onClose}
              aria-label="Tutup"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
            >
              <X size={16} strokeWidth={3} />
            </button>
          </motion.div>

          {/* Toast */}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.95 }}
                className="fixed bottom-6 left-1/2 z-[130] -translate-x-1/2 rounded-clay-full border-3 border-clay-borderLight bg-clay-primary px-6 py-3 text-sm font-extrabold text-white shadow-clay-btn"
              >
                {toast}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Ikon user kecil (hindari import tambahan di atas). */
function UsersIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
