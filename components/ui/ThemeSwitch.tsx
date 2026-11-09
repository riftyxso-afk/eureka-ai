"use client";

import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/context/LocaleContext";
import { useTheme } from "@/context/ThemeContext";

export default function ThemeSwitch() {
  const { locale } = useI18n();
  const { resolved, toggle } = useTheme();
  return (
    <button type="button" role="switch" aria-label={locale === "en" ? "Dark mode" : "Mode gelap"} aria-checked={resolved === "dark"}
      className="eureka-theme-switch" onClick={toggle}>
      <Sun size={15} aria-hidden="true" />
      <Moon size={15} aria-hidden="true" />
      <span aria-hidden="true" />
    </button>
  );
}
