"use client";

/**
 * Banner sekali-saja untuk pengguna yang MELEWATI onboarding:
 * menawarkan buku Panduan sebagai jalur belajar mandiri tentang aplikasi.
 * Hilang permanen setelah ditutup (localStorage), dan tidak pernah tampil
 * bagi pengguna yang sudah menyelesaikan onboarding.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpenCheck, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";

const DISMISS_KEY = "eureka_guide_banner_dismissed";

export default function GuideBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // storage tidak tersedia → tetap cek profil
    }
    const userId = getUserId();
    if (!userId) return;
    (async () => {
      try {
        const res = await apiFetch(
          `/api/profile?userId=${encodeURIComponent(userId)}`
        );
        if (!res.ok) return;
        const payload = await res.json();
        const u = payload?.user;
        const show =
          !!u?.profileData?.onboardingSkipped && !u?.onboardingCompleted;
        if (!cancelled && show) setVisible(true);
      } catch {
        // diam — banner hanya opsional
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // abaikan
    }
  };

  if (!visible) return null;

  return (
    <div className="mt-5 flex items-start gap-3 rounded-clay-md border-2 border-clay-primary/40 bg-clay-primary/10 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-clay-md bg-clay-primary text-white shadow-clay-sm">
        <BookOpenCheck size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-clay-dark">
          Baru di sini? Baca Panduan singkat dulu yuk
        </p>
        <p className="mt-0.5 text-xs font-semibold text-clay-muted">
          Pelajari cara membuat catatan, uji pemahaman, jadwal, dan misi — ±2
          menit saja.
        </p>
      </div>
      <Link
        href="/dashboard/panduan"
        className="btn-clay-primary hidden !min-h-[40px] !px-4 text-xs sm:flex"
      >
        Buka Panduan
      </Link>
      <Link
        href="/dashboard/panduan"
        className="btn-clay-primary flex !min-h-[36px] !px-3 text-[11px] sm:hidden"
      >
        Panduan
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Tutup banner panduan"
        title="Tutup"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-clay-muted transition-colors hover:bg-clay-beige hover:text-clay-dark"
      >
        <X size={16} />
      </button>
    </div>
  );
}
