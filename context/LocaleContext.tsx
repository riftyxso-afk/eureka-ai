"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  dictionaries,
  type Dictionary,
  type Locale,
  DEFAULT_LOCALE,
  getDictionary,
} from "@/lib/i18n";

const LOCALE_COOKIE = "eureka_locale";

interface LocaleContextValue {
  locale: Locale;
  dict: Dictionary;
  /** Ganti bahasa (set cookie lalu navigasi ke URL ber-prefix locale). */
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Provider bahasa. `initialLocale` ditentukan server-side (middleware /
 * root layout) sehingga tidak ada flash salah bahasa. Komponen client
 * memakai useI18n() untuk membaca locale + dictionary.
 */
export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    } catch {
      // abaikan — cookie tetap diset via middleware saat navigasi
    }
    // Navigasi ke URL ber-prefix locale baru (URL asli di-rewrite middleware).
    const path = window.location.pathname;
    const rest = path.replace(/^\/(id|en)(\/|$)/, "/");
    const target = `/${next}${rest === "/" ? "/" : rest}`;
    window.location.href = target + window.location.search + window.location.hash;
  }, []);

  // Sinkron bila locale berubah lewat navigasi server (popstate/back).
  useEffect(() => {
    const onChange = () => {
      const m = window.location.pathname.match(/^\/(id|en)(\/|$)/);
      const l = m ? (m[1] as Locale) : DEFAULT_LOCALE;
      setLocaleState(l);
    };
    window.addEventListener("popstate", onChange);
    return () => window.removeEventListener("popstate", onChange);
  }, []);

  const value: LocaleContextValue = {
    locale,
    dict: getDictionary(locale),
    setLocale,
  };

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useI18n(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    // Fallback aman bila dipakai di luar provider (jarang) — pakai id.
    return { locale: DEFAULT_LOCALE, dict: dictionaries.id, setLocale: () => {} };
  }
  return ctx;
}

export { LOCALE_COOKIE };
