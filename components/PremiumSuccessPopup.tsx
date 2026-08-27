"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, PartyPopper, Rocket, Sparkles, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { syncAuthSession } from "@/lib/auth";

const BENEFITS = [
  "Chat asisten AI tanpa batas",
  "Web search real-time di jawaban",
  "Generate gambar AI (Eureka Draw)",
  "Kuis & flashcards AI unlimited",
  "Generate catatan AI tak terbatas",
];

/** Interval polling status premium saat kembali dari Pakasir. */
const POLL_INTERVAL_MS = 2500;
/** Maksimal percobaan (±15 detik) — memberi waktu webhook Pakasir memproses. */
const POLL_MAX_ATTEMPTS = 6;
/** Lama notifikasi netral tampil sebelum hilang sendiri. */
const TOAST_DURATION_MS = 6000;

/**
 * Popup hasil pembayaran setelah user kembali dari checkout Pakasir.
 *
 * Trigger: query `?upgrade=done` (redirect Pakasir netral — tidak mengklaim
 * hasil pembayaran; Pakasir hanya mengarahkan kembali setelah bayar sukses).
 * Popup sukses HANYA muncul bila server mengonfirmasi
 * premium aktif (`GET /api/payments/status`), dengan polling singkat untuk
 * menunggu webhook Pakasir. Bila pembayaran tidak selesai (batal/gagal/timeout),
 * tampilkan notifikasi netral — tanpa klaim sukses. Query dibersihkan setelah
 * ditangani agar tidak muncul lagi saat refresh.
 */
function PremiumSuccessPopupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [show, setShow] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const handled = useRef(false);

  // Bersihkan query ?upgrade=... dari URL agar tidak diproses ulang.
  const clearUpgradeParam = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("upgrade");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
  };

  useEffect(() => {
    if (handled.current) return;
    const isDone = searchParams.get("upgrade") === "done";
    if (!isDone) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const checkStatus = async () => {
      if (cancelled || handled.current) return;
      attempts += 1;
      try {
        // Pastikan userId = akun asli (bukan fallback random per-device) agar
        // status premium benar di perangkat mana pun dengan akun yang sama.
        await syncAuthSession().catch(() => undefined);
        const userId = getUserId();
        const res = await apiFetch(
          `/api/payments/status?userId=${encodeURIComponent(userId)}`
        );
        const data = res.ok
          ? ((await res.json()) as { isPremium?: boolean })
          : null;
        if (cancelled || handled.current) return;
        if (data?.isPremium) {
          // Server mengonfirmasi premium aktif → tampilkan popup sukses.
          // PENTING: `handled` di-set DI SINI (setelah hasil nyata), bukan
          // sebelum scheduling — React StrictMode (dev) menjalankan effect
          // dua kali; cleanup membatalkan poller lama via `cancelled`.
          handled.current = true;
          clearUpgradeParam();
          timer = setTimeout(() => setShow(true), 400);
          return;
        }
      } catch {
        // gagal sementara → lanjut polling berikutnya
      }
      if (cancelled || handled.current) return;
      if (attempts < POLL_MAX_ATTEMPTS) {
        timer = setTimeout(checkStatus, POLL_INTERVAL_MS);
      } else {
        // Timeout — pembayaran tidak selesai (batal/gagal/webhook belum
        // sampai): notifikasi netral, TANPA klaim sukses.
        handled.current = true;
        clearUpgradeParam();
        setToast("Pembayaran belum selesai — kamu masih di paket Free");
      }
    };

    // Mulai polling setelah halaman selesai render.
    timer = setTimeout(checkStatus, 600);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [searchParams, router]);

  // Auto-hilangkan notifikasi netral.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const handleClose = () => {
    setShow(false);
    clearUpgradeParam();
  };

  return (
    <>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={(e) => {
              if (!(e.target as Element).closest("[data-success-card]"))
                handleClose();
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 200, damping: 22 }}
              data-success-card
              className="relative w-full max-w-md overflow-hidden rounded-clay bg-clay-cream shadow-2xl"
            >
              {/* Header gradient emas */}
              <div className="relative bg-gradient-to-br from-clay-primary via-clay-secondary to-amber-500 px-6 pb-8 pt-7 text-center">
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <Sparkles className="absolute left-4 top-4 text-white/60" size={20} />
                  <PartyPopper className="absolute right-5 top-6 text-white/50" size={18} />
                  <PartyPopper className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/50" size={20} />
                </div>
                <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-clay-cream/20 ring-4 ring-white/30">
                  <Crown size={30} className="text-white" />
                </div>
                <h2 className="relative mt-3 flex items-center justify-center gap-2 text-2xl font-extrabold text-white drop-shadow">
                  Selamat! Kamu Berhasil Berlangganan
                </h2>
                <p className="relative mt-1 text-sm font-bold text-white/90">
                  Paket Pro Eureka.AI sekarang aktif untuk akunmu
                </p>
              </div>

              {/* Body: benefit */}
              <div className="px-6 py-6">
                <p className="flex items-center gap-2 text-sm font-extrabold text-clay-dark">
                  <PartyPopper size={16} className="text-clay-primary" />
                  Semua fitur Pro sudah terbuka:
                </p>
                <ul className="mt-3 flex flex-col gap-2.5">
                  {BENEFITS.map((b) => (
                    <li
                      key={b}
                      className="flex items-center gap-3 rounded-clay-md bg-clay-beige/60 px-4 py-2.5 text-sm font-bold text-clay-dark"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-clay-success text-[11px] font-extrabold text-white">
                        ✓
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleClose}
                  className="btn-clay-primary mt-5 w-full py-3 text-base font-extrabold"
                >
                  <Rocket size={18} className="mr-2" /> Mulai Belajar!
                </button>
                <p className="mt-3 text-center text-[11px] font-semibold text-clay-muted">
                  Selamat menikmati pengalaman belajar tanpa batas
                </p>
              </div>

              {/* Tombol tutup */}
              <button
                onClick={handleClose}
                aria-label="Tutup"
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-clay-cream/20 text-white transition-colors hover:bg-white/30"
              >
                <X size={16} strokeWidth={3} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notifikasi netral — pembayaran tidak selesai (batal/gagal/timeout) */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 z-[110] -translate-x-1/2 rounded-clay-full border-3 border-clay-borderLight bg-clay-beige px-6 py-3 text-center text-sm font-extrabold text-clay-dark shadow-clay-btn"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * useSearchParams butuh Suspense boundary — kalau tidak, halaman statis
 * gagal di-prerender (build error). Komponen ini dirender di root layout,
 * jadi wajib dibungkus.
 */
export default function PremiumSuccessPopup() {
  return (
    <Suspense fallback={null}>
      <PremiumSuccessPopupInner />
    </Suspense>
  );
}
