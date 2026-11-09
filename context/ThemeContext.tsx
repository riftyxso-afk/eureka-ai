"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";

import { flushSync } from "react-dom";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const THEME_KEY = "eureka_theme";

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

function resolveTheme(pref: Theme): ResolvedTheme {
  return pref === "system" ? getSystemTheme() : pref;
}

interface ThemeContextValue {
  /** Preferensi user: light | dark | system. */
  theme: Theme;
  /** Tema yang benar-benar aktif (system sudah di-resolve). */
  resolved: ResolvedTheme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Provider mode gelap untuk area login. Mengatur class `dark` di
 * documentElement; preferensi disimpan di localStorage `eureka_theme`
 * (default: mengikuti preferensi sistem).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme | null>(null);
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  useEffect(() => {
    if (theme !== null) return;
    let preference: Theme = "system";
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark" || saved === "system") preference = saved;
    } catch {
      // Use the system theme when storage is unavailable.
    }
    setResolved(resolveTheme(preference));
    setThemeState(preference);
  }, [theme]);

  useEffect(() => {
    if (theme === null) return;
    const apply = () => {
      const r = resolveTheme(theme);
      setResolved(r);
      document.documentElement.classList.toggle("dark", r === "dark");
    };
    apply();

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => apply();
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
  }, [theme]);

  const transition = useRef<ViewTransition | null>(null);
  const setTheme = useCallback((t: Theme) => {
    const next = resolveTheme(t);
    const update = () => {
      setThemeState(t);
      setResolved(next);
      document.documentElement.classList.toggle("dark", next === "dark");
    };
    transition.current?.skipTransition();
    if (document.startViewTransition && next !== resolved &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const active = document.startViewTransition(() => flushSync(update));
      transition.current = active;
      void active.finished.catch(() => {}).finally(() => {
        if (transition.current === active) transition.current = null;
      });
    } else {
      update();
    }
    try {
      window.localStorage.setItem(THEME_KEY, t);
    } catch {
      // storage tidak tersedia
    }
  }, [resolved]);

  const toggle = useCallback(() => {
    setTheme(resolved === "dark" ? "light" : "dark");
  }, [resolved, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme: theme ?? "system", resolved, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme harus dipakai di dalam ThemeProvider");
  return ctx;
}
