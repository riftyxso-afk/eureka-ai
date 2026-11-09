"use client";

import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/context/LocaleContext";
import { useTheme } from "@/context/ThemeContext";
import "./theme-switch.css";

export default function ThemeSwitch() {
  const { locale } = useI18n();
  const { resolved, toggle } = useTheme();
  const isDark = resolved === "dark";
  const nextThemeLabel = locale === "en"
    ? `Switch to ${isDark ? "light" : "dark"} mode`
    : `Beralih ke mode ${isDark ? "terang" : "gelap"}`;
  return (
    <button type="button" role="switch" aria-label={locale === "en" ? "Dark mode" : "Mode gelap"}
      aria-checked={isDark} title={nextThemeLabel} className="eureka-theme-switch" onClick={toggle}>
      <span className="eureka-theme-track" aria-hidden="true">
        <Sun className="eureka-theme-track-sun" size={14} />
        <Moon className="eureka-theme-track-moon" size={14} />
        <span className="eureka-theme-thumb">
          <Sun className="eureka-theme-glyph eureka-theme-sun" size={15} />
          <Moon className="eureka-theme-glyph eureka-theme-moon" size={15} />
        </span>
      </span>
    </button>
  );
}
