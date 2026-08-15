"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "./apiClient";
import { getUserId } from "./identity";
import { syncAuthSession, isLoggedIn } from "./auth";

export interface BetaStatus {
  isBeta: boolean;
  joinedAt: string | null;
}

const EMPTY: BetaStatus = { isBeta: false, joinedAt: null };

/**
 * Hook status beta tester — diambil dari server (GET /api/beta/status).
 * Dipakai untuk gating fitur baru (mic composer & AI call).
 */
export function useBeta() {
  const [status, setStatus] = useState<BetaStatus>(EMPTY);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      await syncAuthSession();
    } catch {
      // mode dev tanpa Supabase — lanjut
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
        `/api/beta/status?userId=${encodeURIComponent(userId)}`
      );
      if (!res.ok) {
        if (res.status === 401) setStatus(EMPTY);
        else console.warn("[useBeta] status gagal:", res.status);
        return;
      }
      const data = (await res.json()) as Partial<BetaStatus>;
      setStatus({
        isBeta: data.isBeta === true,
        joinedAt: data.joinedAt ?? null,
      });
    } catch (e) {
      console.warn("[useBeta] error:", e);
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
