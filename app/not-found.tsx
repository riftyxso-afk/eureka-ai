"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Home, LayoutDashboard, SearchX } from "lucide-react";
import { isLoggedIn } from "@/lib/auth";

/**
 * Halaman 404 global bergaya clay Eureka — menggantikan template Next.js.
 * Dipakai otomatis untuk semua rute yang tidak cocok di seluruh aplikasi.
 *
 * Catatan hydration: isLoggedIn() hanya dibaca setelah mount (useEffect),
 * bukan saat render — mencegah mismatch server (tanpa localStorage) vs
 * client (dengan localStorage).
 */
export default function NotFound() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
  }, []);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-clay-beige px-4 py-10">
      <div className="card-clay w-full max-w-md rounded-clay p-8 text-center shadow-clay-lg">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-clay-full bg-clay-primary/10">
          <SearchX size={32} className="text-clay-primary" />
        </div>
        <p className="mt-5 text-6xl font-extrabold tracking-tight text-clay-primary">
          404
        </p>
        <h1 className="mt-2 text-xl font-extrabold text-clay-dark sm:text-2xl">
          Halaman tidak ditemukan
        </h1>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-clay-muted">
          Halaman yang kamu cari tidak ada, sudah dipindah, atau alamatnya salah
          ketik. Yuk kembali ke tempat yang benar.
        </p>
        <div className="mt-7">
          <Link
            href={loggedIn ? "/dashboard" : "/"}
            className="btn-clay-primary inline-flex w-full items-center justify-center gap-2 !min-h-[48px]"
          >
            {loggedIn ? <LayoutDashboard size={18} /> : <Home size={18} />}
            {loggedIn ? "Kembali ke Dashboard" : "Kembali ke Beranda"}
          </Link>
        </div>
        {loggedIn && (
          <Link
            href="/"
            className="mt-3 inline-flex items-center justify-center gap-2 text-xs font-extrabold text-clay-muted transition-colors hover:text-clay-primary"
          >
            <Home size={14} />
            Buka halaman beranda
          </Link>
        )}
      </div>
    </div>
  );
}
