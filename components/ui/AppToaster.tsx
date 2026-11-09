"use client";

import { Toaster } from "@yusufceng1z/ding-react";
import { useI18n } from "@/context/LocaleContext";
import { useTheme } from "@/context/ThemeContext";

export default function AppToaster() {
  const { locale } = useI18n();
  const { resolved } = useTheme();
  return <Toaster position="top-center" theme={resolved}
    labels={locale === "en" ? { region: "Notifications", dismiss: "Dismiss notification" }
      : { region: "Notifikasi", dismiss: "Tutup notifikasi" }} />;
}
