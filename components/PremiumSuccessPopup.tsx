"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, PartyPopper, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

const BENEFITS = [
  "Chat asisten AI tanpa batas",
  "Web search real-time di jawaban",
  "Generate gambar AI (Eureka Draw)",
  "Kuis & flashcards AI unlimited",
  "Generate catatan AI tak terbatas",
];

/**
 * Popup selamat datang setelah user berhasil berlangganan Pro.
 * Muncul saat kembali dari checkout Mayar dengan query `?upgrade=success`
 * (lihat MAYAR_REDIRECT_URL di backend /api/payments/checkout).
 * Setelah ditutup, query dibersihkan agar tidak muncul lagi saat refresh.
 */
function PremiumSuccessPopupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [show, setShow] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    const isSuccess = searchParams.get("upgrade") === "success";
    if (!isSuccess) return;
    handled.current = true;
    // Tampilkan popup setelah halaman selesai render.
    const timer = setTimeout(() => setShow(true), 600);
    return () => clearTimeout(timer);
  }, [searchParams]);

  const handleClose = () => {
    setShow(false);
    // Bersihkan query ?upgrade=success dari URL agar tidak muncul lagi.
    const params = new URLSearchParams(searchParams.toString());
    params.delete("upgrade");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
  };

  return (
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
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            {/* Header gradient emas */}
            <div className="relative bg-gradient-to-br from-clay-primary via-clay-secondary to-amber-500 px-6 pb-8 pt-7 text-center">
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <span className="absolute left-4 top-4 text-2xl opacity-50">✨</span>
                <span className="absolute right-5 top-6 text-xl opacity-40">🎉</span>
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-2xl opacity-40">
                  🎊
                </span>
              </div>
              <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20 ring-4 ring-white/30">
                <Crown size={30} className="text-white" />
              </div>
              <h2 className="relative mt-3 text-2xl font-extrabold text-white drop-shadow">
                Selamat! Kamu Berhasil Berlangganan 👑
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
                Mulai Belajar! 🚀
              </button>
              <p className="mt-3 text-center text-[11px] font-semibold text-clay-muted">
                Selamat menikmati pengalaman belajar tanpa batas 💜
              </p>
            </div>

            {/* Tombol tutup */}
            <button
              onClick={handleClose}
              aria-label="Tutup"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
            >
              <X size={16} strokeWidth={3} />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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
