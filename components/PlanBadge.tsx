"use client";

import { Crown } from "lucide-react";
import { usePremium } from "@/lib/usePremium";

interface PlanBadgeProps {
  /** Ukuran badge: sm (sidebar/chip) atau md (halaman profil). */
  size?: "sm" | "md";
  className?: string;
}

/**
 * Badge status paket user (Pro/Trial/Free), bersumber dari server
 * (`GET /api/payments/status` via usePremium) — bukan localStorage.
 * - Pro   (tier normal/promo): emas + ikon mahkota
 * - Trial (tier trial):        ungu
 * - Free  (non-premium):       abu-abu
 * Tidak dirender apa pun selama status masih dimuat agar tidak
 * menampilkan "Free" yang salah saat loading.
 */
export function PlanBadge({ size = "sm", className = "" }: PlanBadgeProps) {
  const { isPremium, tier, loading } = usePremium();

  let label = "Free";
  let variant: "free" | "trial" | "pro" = "free";
  if (isPremium) {
    if (tier === "trial") {
      label = "Trial";
      variant = "trial";
    } else {
      label = "Pro";
      variant = "pro";
    }
  }

  if (loading) return null;

  const sizeCls =
    size === "md"
      ? "gap-1.5 px-3.5 py-1 text-sm"
      : "gap-1 px-2 py-0.5 text-[10px]";
  const styleMap = {
    pro: "border-amber-500 bg-amber-100 text-amber-700",
    trial: "border-clay-primary bg-clay-primary/10 text-clay-primary",
    free: "border-clay-shadow/60 bg-clay-beige/80 text-clay-muted",
  };

  return (
    <span
      className={`inline-flex items-center rounded-clay-full border-2 font-extrabold leading-none ${sizeCls} ${styleMap[variant]} ${className}`}
    >
      {variant === "pro" && (
        <Crown
          size={size === "md" ? 14 : 11}
          className="shrink-0"
          aria-hidden
        />
      )}
      {label}
    </span>
  );
}
