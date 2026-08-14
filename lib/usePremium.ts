"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "./apiClient";
import { getUserId } from "./identity";

export interface PremiumStatus {
  isPremium: boolean;
  tier: "promo" | "normal" | "trial" | null;
  premiumUntil: string | null;
  licenseCode: string | null;
}

const EMPTY: PremiumStatus = {
  isPremium: false,
  tier: null,
  premiumUntil: null,
  licenseCode: null,
};

/**
 * Hook status premium — diambil dari server (GET /api/payments/status),
 * bukan localStorage. Otomatis dimuat saat mount & bisa di-refresh manual
 * (mis. setelah kembali dari checkout Mayar).
 */
export function usePremium() {
  const [status, setStatus] = useState<PremiumStatus>(EMPTY);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const userId = getUserId();
    if (!userId) {
      setStatus(EMPTY);
      setLoading(false);
      return;
    }
    try {
      const res = await apiFetch(
        `/api/payments/status?userId=${encodeURIComponent(userId)}`
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (res.status === 401) {
          // Belum login → bukan premium.
          setStatus(EMPTY);
        } else {
          console.warn("[usePremium] status gagal:", body?.error ?? res.status);
          setStatus(EMPTY);
        }
        return;
      }
      const data = (await res.json()) as Partial<PremiumStatus>;
      setStatus({
        isPremium: data.isPremium === true,
        tier: data.tier ?? null,
        premiumUntil: data.premiumUntil ?? null,
        licenseCode: data.licenseCode ?? null,
      });
    } catch (e) {
      console.warn("[usePremium] error:", e);
      setStatus(EMPTY);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  return { ...status, loading, refresh };
}
