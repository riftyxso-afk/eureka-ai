"use client";

import { Toaster } from "@yusufceng1z/ding-react";
import { useEffect, useRef } from "react";
import { bindSuccessToast } from "@/lib/toast";
import { useSakuga, type SakugaToastElement } from "./sakuga";
import { useI18n } from "@/context/LocaleContext";
import { useTheme } from "@/context/ThemeContext";

export default function AppToaster() {
  const { locale } = useI18n();
  const { resolved } = useTheme();
  const ready = useSakuga("toast");
  const toastRef = useRef<SakugaToastElement>(null);
  useEffect(() => {
    const el = toastRef.current;
    if (!el) return;
    el.shadowRoot?.querySelector('[part="close"]')?.setAttribute("aria-label", locale === "en" ? "Dismiss notification" : "Tutup notifikasi");
    return bindSuccessToast(message => el.show(message));
  }, [ready, locale]);
  return <><Toaster position="top-center" theme={resolved}
    labels={locale === "en" ? { region: "Notifications", dismiss: "Dismiss notification" }
      : { region: "Notifikasi", dismiss: "Tutup notifikasi" }} />
      {ready && <sakuga-toast ref={toastRef} className="eureka-sakuga sakuga-toast-host" />}
    </>;
}
