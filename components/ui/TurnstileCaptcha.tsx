"use client";

import { useEffect, useRef } from "react";
import { ShieldCheck } from "lucide-react";
import { getTurnstileSiteKey } from "@/lib/captcha";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        }
      ) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

interface TurnstileCaptchaProps {
  /** Dipanggil dengan token saat selesai, atau null saat kedaluwarsa/error. */
  onToken: (token: string | null) => void;
  theme?: "light" | "dark" | "auto";
  className?: string;
}

/**
 * Widget CAPTCHA Cloudflare Turnstile.
 * - Memuat skrip Turnstile sekali lalu render widget ke dalam div.
 * - Token bersifat sekali pakai — setelah submit, remount komponen ini
 *   (ganti `key`) agar pengguna menyelesaikan verifikasi baru.
 * - Bila site key belum diatur: tampilkan catatan kecil & tidak memblokir.
 */
export default function TurnstileCaptcha({
  onToken,
  theme = "auto",
  className = "",
}: TurnstileCaptchaProps) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const siteKey = getTurnstileSiteKey();

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let cancelled = false;
    const el = ref.current;

    const render = () => {
      if (cancelled || !window.turnstile) return;
      widgetId.current = window.turnstile.render(el, {
        sitekey: siteKey,
        theme,
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      });
    };

    const SCRIPT_SRC =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    if (window.turnstile) {
      render();
      return;
    }
    // Hindari memuat script 2x (mis. StrictMode mount ganda) → warning Turnstile.
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`
    );
    if (existing) {
      if (existing.dataset.loaded === "1") {
        render();
      } else {
        existing.addEventListener("load", render, { once: true });
      }
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      s.dataset.loaded = "1";
      render();
    };
    document.head.appendChild(s);

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          // widget sudah dihapus
        }
        widgetId.current = null;
      }
    };
  }, [siteKey, theme, onToken]);

  if (!siteKey) {
    return (
      <p className="flex items-center justify-center gap-1.5 rounded-clay-md border-2 border-dashed border-clay-shadow/40 px-3 py-2.5 text-center text-[11px] font-bold text-clay-muted">
        <ShieldCheck size={13} className="shrink-0" />
        Verifikasi keamanan belum aktif (key Turnstile belum diatur).
      </p>
    );
  }

  return (
    <div
      ref={ref}
      className={`flex min-h-[65px] items-center justify-center ${className}`}
      aria-label="Verifikasi keamanan"
    />
  );
}
