"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const DISMISS_KEY = "eureka_kemerdekaan_dismissed";

export default function KemerdekaanPopup() {
  const [show, setShow] = useState(false);
  const [animatePrice, setAnimatePrice] = useState(false);

  useEffect(() => {
    // Check if user already dismissed
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) return;

    // Show popup after a short delay
    const timer = setTimeout(() => {
      setShow(true);
      // Trigger price animation after popup appears
      setTimeout(() => setAnimatePrice(true), 300);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, "true");
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {/* Confetti-like decorative elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[10%] top-[15%] text-4xl opacity-60 animate-bounce" style={{ animationDelay: "0s" }}>🇮🇩</div>
        <div className="absolute right-[15%] top-[20%] text-3xl opacity-50 animate-bounce" style={{ animationDelay: "0.2s" }}>🎉</div>
        <div className="absolute bottom-[20%] left-[20%] text-3xl opacity-50 animate-bounce" style={{ animationDelay: "0.4s" }}>🎆</div>
        <div className="absolute bottom-[25%] right-[10%] text-4xl opacity-60 animate-bounce" style={{ animationDelay: "0.6s" }}>🎇</div>
        <div className="absolute left-[5%] top-[50%] text-2xl opacity-40 animate-pulse">⭐</div>
        <div className="absolute right-[5%] top-[45%] text-2xl opacity-40 animate-pulse" style={{ animationDelay: "0.3s" }}>⭐</div>
      </div>

      {/* Popup Card */}
      <div className="relative w-full max-w-md animate-in zoom-in-95 fade-in duration-300">
        <div className="overflow-hidden rounded-3xl border-4 border-red-600 shadow-2xl">
          {/* Header - Red */}
          <div className="relative bg-gradient-to-r from-red-600 via-red-500 to-red-600 px-6 py-5 text-center">
            {/* Decorative stars */}
            <div className="absolute left-3 top-3 text-white/30 text-lg">✦</div>
            <div className="absolute right-3 top-3 text-white/30 text-lg">✦</div>
            
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-2xl">🇮🇩</span>
              <span className="text-sm font-extrabold uppercase tracking-widest text-yellow-300">
                Dirgahayu RI
              </span>
              <span className="text-2xl">🇮🇩</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white drop-shadow-lg">
              🎉 Promo Kemerdekaan! 🎉
            </h2>
          </div>

          {/* Body - White */}
          <div className="bg-white px-6 py-6 text-center">
            <p className="text-sm font-bold text-gray-600 mb-4">
              Merayakan Hari Kemerdekaan Indonesia ke-81
            </p>

            {/* Price section */}
            <div className="mb-4">
              <p className="text-sm font-bold text-gray-500 mb-1">Harga Normal</p>
              <div className={`text-2xl font-extrabold text-gray-400 ${animatePrice ? "line-through decoration-red-500 decoration-[3px]" : ""} transition-all duration-700`}>
                Rp 59.000
                <span className="text-sm font-bold">/bulan</span>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center my-2">
              <div className="text-3xl text-red-500 animate-bounce">⬇️</div>
            </div>

            {/* Promo price */}
            <div className="relative inline-block">
              <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 opacity-20 blur-sm"></div>
              <div className="relative bg-gradient-to-r from-red-50 to-red-100 rounded-2xl px-8 py-4 border-2 border-red-200">
                <p className="text-xs font-extrabold uppercase tracking-wider text-red-600 mb-1">
                  Harga Spesial Kemerdekaan
                </p>
                <div className="text-5xl font-extrabold text-red-600 drop-shadow-md">
                  Rp 5.000
                  <span className="text-lg font-bold text-red-400">/bulan</span>
                </div>
                <p className="mt-2 text-xs font-bold text-green-600 bg-green-100 rounded-full px-3 py-1 inline-block">
                  Hemat 91%! 🔥
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs font-semibold text-gray-500">
              Berlaku selama bulan Agustus 2026
            </p>
          </div>

          {/* Footer - White with red accent */}
          <div className="bg-white border-t-2 border-red-100 px-6 py-4">
            <a
              href="/register"
              className="block w-full rounded-2xl bg-gradient-to-r from-red-600 to-red-500 py-4 text-center text-base font-extrabold text-white shadow-lg shadow-red-500/30 transition-all hover:from-red-700 hover:to-red-600 hover:shadow-xl hover:shadow-red-500/40 active:scale-[0.98]"
            >
              Klaim Promo Sekarang! 🚀
            </a>
            <button
              onClick={handleClose}
              className="mt-3 w-full text-center text-xs font-bold text-gray-400 transition-colors hover:text-red-500"
            >
              Nanti aja, jangan ingatkan lagi
            </button>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute -right-2 -top-2 flex h-10 w-10 items-center justify-center rounded-full border-2 border-red-200 bg-white text-red-500 shadow-lg transition-all hover:scale-110 hover:bg-red-50 hover:text-red-600"
          aria-label="Tutup"
        >
          <X size={18} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}
