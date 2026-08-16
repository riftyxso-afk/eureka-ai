"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

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
 * (default: mengikuti preferensi sistem). Halaman publik tidak punya
 * varian dark, jadi otomatis tetap terang.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark" || saved === "system") {
        return saved;
      }
    } catch {
      // storage tidak tersedia
    }
    return "system";
  });

  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolveTheme(theme)
  );

  useEffect(() => {
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

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      window.localStorage.setItem(THEME_KEY, t);
    } catch {
      // storage tidak tersedia
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(resolved === "dark" ? "light" : "dark");
  }, [resolved, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme harus dipakai di dalam ThemeProvider");
  return ctx;
}
