"use client";

/**
 * EurekaOrb — pembungkus tipis pustaka thinking-orbs.
 *
 * Pemetaan semantik konteks → state pustaka terpusat di sini agar
 * pemanggil tidak pernah menyentuh string state mentah:
 *   thinking  → "composing" (asisten sedang menyusun jawaban)
 *   searching → "searching" (pipeline pencarian web)
 *   working   → "working"   (memproses / membuat catatan)
 *   connecting→ "connecting"(memuat sesi percakapan)
 *
 * Ukuran hanya dua preset resmi pustaka: inline=20, avatar=64.
 * Tema "auto" mengikuti class .dark aplikasi secara live.
 */

import { ThinkingOrb, type OrbState, type OrbSize } from "thinking-orbs";
import type { CSSProperties } from "react";

export type OrbVariant = "thinking" | "searching" | "working" | "connecting";
export type OrbScale = "inline" | "avatar";

const VARIANT_TO_STATE: Record<OrbVariant, OrbState> = {
  thinking: "composing",
  searching: "searching",
  working: "working",
  connecting: "connecting",
};

const SCALE_TO_SIZE: Record<OrbScale, OrbSize> = {
  inline: 20,
  avatar: 64,
};

interface EurekaOrbProps {
  variant: OrbVariant;
  scale?: OrbScale;
  /** Label aksesibilitas; default generik "Memuat". */
  label?: string;
  className?: string;
}

export default function EurekaOrb({
  variant,
  scale = "inline",
  label = "Memuat",
  className,
}: EurekaOrbProps) {
  const style: CSSProperties =
    scale === "inline"
      ? { display: "inline-block", verticalAlign: "-5px" }
      : { display: "block" };
  return (
    <ThinkingOrb
      state={VARIANT_TO_STATE[variant]}
      size={SCALE_TO_SIZE[scale]}
      theme="auto"
      aria-label={label}
      className={className}
      style={style}
    />
  );
}
