"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Moon, Sun, Menu, X, ChevronDown } from "lucide-react";
import { useI18n } from "@/context/LocaleContext";
import { useTheme } from "@/context/ThemeContext";

interface PillNavbarProps {
  loggedIn: boolean;
}

export function PillNavbar({ loggedIn }: PillNavbarProps) {
  const { locale, dict, setLocale } = useI18n();
  const { resolved, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleLanguage = () => {
    setLocale(locale === "id" ? "en" : "id");
  };

  const isDark = mounted && resolved === "dark";

  return (
    <header className="sticky top-0 z-50 w-full px-3 sm:px-6 lg:px-8 pt-3 pb-2 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-5xl rounded-full bg-white/85 dark:bg-[#161528]/85 backdrop-blur-md border border-gray-200/80 dark:border-white/10 shadow-[0_10px_30px_rgba(17,24,39,0.08)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] px-4 sm:px-6 py-2.5 flex items-center justify-between transition-colors duration-200">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group focus:outline-none focus:ring-2 focus:ring-violet-500 rounded-full pr-2"
          aria-label="Eureka.AI Beranda"
        >
          <div className="relative w-8 h-8 rounded-full overflow-hidden bg-violet-100 dark:bg-violet-950 flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="Eureka AI"
              width={32}
              height={32}
              className="object-cover"
              priority
            />
          </div>
          <span className="font-bold text-base sm:text-lg tracking-tight text-[#1A1A2E] dark:text-white">
            eureka<span className="text-[#7C3AED]">.ai</span>
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <nav
          aria-label="Navigasi Utama"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-gray-600 dark:text-gray-300"
        >
          <a
            href="#fitur"
            className="hover:text-[#7C3AED] dark:hover:text-violet-400 transition-colors"
          >
            {dict.nav.fitur}
          </a>
          <Link
            href="/pricing"
            className="hover:text-[#7C3AED] dark:hover:text-violet-400 transition-colors"
          >
            {dict.nav.harga}
          </Link>
          <a
            href="#ulasan"
            className="hover:text-[#7C3AED] dark:hover:text-violet-400 transition-colors"
          >
            {dict.nav.ulasan}
          </a>
          <a
            href="#faq"
            className="hover:text-[#7C3AED] dark:hover:text-violet-400 transition-colors"
          >
            {dict.nav.faq}
          </a>
        </nav>

        {/* Actions Desktop */}
        <div className="hidden sm:flex items-center gap-2.5">
          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggle}
            aria-label={
              !mounted
                ? "Beralih tema"
                : isDark
                ? "Beralih ke mode terang"
                : "Beralih ke mode gelap"
            }
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            {isDark ? (
              <Sun size={18} className="text-amber-400" />
            ) : (
              <Moon size={18} />
            )}
          </button>

          {/* Language Switcher */}
          <button
            type="button"
            onClick={toggleLanguage}
            aria-label="Ganti bahasa"
            className="h-8 px-2.5 rounded-full border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-xs font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <span>{locale.toUpperCase()}</span>
            <ChevronDown size={12} className="opacity-60" />
          </button>

          {/* Auth Button */}
          {loggedIn ? (
            <Link
              href="/dashboard"
              className="h-9 px-4 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] active:bg-[#5B21B6] text-white text-xs sm:text-sm font-semibold flex items-center justify-center transition-all shadow-[0_4px_12px_rgba(124,58,237,0.25)] focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
            >
              {dict.nav.bukaDashboard}
            </Link>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link
                href="/login"
                className="h-9 px-3.5 rounded-full text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-[#7C3AED] dark:hover:text-violet-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              >
                {dict.nav.masuk}
              </Link>
              <Link
                href="/register"
                className="h-9 px-4 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] active:bg-[#5B21B6] text-white text-xs sm:text-sm font-semibold flex items-center justify-center transition-all shadow-[0_4px_12px_rgba(124,58,237,0.25)] focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
              >
                {dict.nav.cobaGratis}
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex sm:hidden items-center gap-1.5">
          <button
            type="button"
            onClick={toggle}
            aria-label="Toggle theme"
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400"
          >
            {isDark ? (
              <Sun size={16} className="text-amber-400" />
            ) : (
              <Moon size={16} />
            )}
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="pointer-events-auto mx-auto max-w-5xl mt-2 rounded-2xl bg-white/95 dark:bg-[#161528]/95 backdrop-blur-xl border border-gray-200 dark:border-white/10 shadow-2xl p-5 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col gap-3 font-medium text-sm text-gray-700 dark:text-gray-200">
            <a
              href="#fitur"
              onClick={() => setMobileOpen(false)}
              className="py-1.5 px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
            >
              {dict.nav.fitur}
            </a>
            <Link
              href="/pricing"
              onClick={() => setMobileOpen(false)}
              className="py-1.5 px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
            >
              {dict.nav.harga}
            </Link>
            <a
              href="#ulasan"
              onClick={() => setMobileOpen(false)}
              className="py-1.5 px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
            >
              {dict.nav.ulasan}
            </a>
            <a
              href="#faq"
              onClick={() => setMobileOpen(false)}
              className="py-1.5 px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"
            >
              {dict.nav.faq}
            </a>
          </nav>
          <div className="pt-3 border-t border-gray-100 dark:border-white/10 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={toggleLanguage}
              className="h-9 px-3 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5"
            >
              Bahasa: <span className="text-[#7C3AED]">{locale.toUpperCase()}</span>
            </button>
            {loggedIn ? (
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="flex-1 h-9 px-4 rounded-xl bg-[#7C3AED] text-white text-xs font-semibold flex items-center justify-center shadow-md"
              >
                {dict.nav.bukaDashboard}
              </Link>
            ) : (
              <div className="flex items-center gap-2 flex-1">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 h-9 px-3 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-medium text-center flex items-center justify-center text-gray-700 dark:text-gray-200"
                >
                  {dict.nav.masuk}
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 h-9 px-3 rounded-xl bg-[#7C3AED] text-white text-xs font-semibold text-center flex items-center justify-center shadow-md"
                >
                  {dict.nav.cobaGratis}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
