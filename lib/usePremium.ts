"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "./apiClient";
import { getUserId } from "./identity";
import { syncAuthSession, isLoggedIn } from "./auth";

export interface PremiumStatus {
  isPremium: boolean;
  tier: "promo" | "normal" | "trial" | null;
  premiumUntil: string | null;
}

const EMPTY: PremiumStatus = {
  isPremium: false,
  tier: null,
  premiumUntil: null,
};

/**
 * Hook status premium — diambil dari server (GET /api/payments/status),
 * bukan localStorage. Otomatis dimuat saat mount & bisa di-refresh manual
 * (mis. setelah kembali dari checkout Pakasir).
 */
export function usePremium() {
  const [status, setStatus] = useState<PremiumStatus>(EMPTY);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    // Sync sesi dulu → userId yang dipakai HARUS id akun asli dari Supabase,
    // bukan fallback random per-device. Ini yang membuat status premium/trial
    // konsisten di SEMUA perangkat untuk akun yang sama (sebelumnya, device
    // baru tanpa cache sesi dapat userId acak → server menolak → tampak Free).
    try {
      await syncAuthSession();
    } catch {
      // mode dev tanpa Supabase — lanjut (server demo mempercayai param)
    }
    if (!isLoggedIn()) {
      setStatus(EMPTY);
      setLoading(false);
      return;
    }
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
