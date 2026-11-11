"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { captureProductEvent } from "@/lib/productAnalytics";
import type { ProgressStats } from "@/lib/progress-store";

type ProgressState = {
  stats: ProgressStats | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};

const Context = createContext<ProgressState | null>(null);
const shown = new Set<string>();

export function useV2Progress() {
  const value = useContext(Context);
  if (!value) throw new Error("V2Progress provider is missing");
  return value;
}

export default function V2Progress({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [celebration, setCelebration] = useState<number | null>(null);
  const request = useRef<AbortController | null>(null);
  const viewedPath = useRef("");
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const userId = getUserId();
    try {
      const response = await apiFetch(`/api/progress?userId=${encodeURIComponent(userId)}`, {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Progres belum bisa dimuat.");
      const { stats: updated } = await response.json() as { stats?: ProgressStats };
      if (controller.signal.aborted) return;
      if (!updated) throw new Error("Progres belum bisa dimuat.");
      setStats(updated);
      setError("");
      const earned = updated.streakDetails?.celebration;
      if (!earned) return;

      const key = `eureka:streak-celebration:${userId}:${earned.days}`;
      const visitKey = `${key}:${earned.earnedOn}`;
      if (shown.has(visitKey)) return;
      shown.add(visitKey);
      try {
        if (localStorage.getItem(key) === earned.earnedOn) return;
        localStorage.setItem(key, earned.earnedOn);
      } catch { /* In-memory deduplication still applies. */ }
      setCelebration(earned.days);
      captureProductEvent({ name: "streak_milestone_celebrated", properties: { days: earned.days } });
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Progres belum bisa dimuat.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [pathname, refresh]);
  useEffect(() => {
    if (viewedPath.current === pathname) return;
    viewedPath.current = pathname;
    const slug = pathname.split("/").filter(Boolean).at(-1);
    const section = slug === "aktivitas" ? "streaks" : slug;
    if (section === "streaks" || section === "profil" || section === "pricing") {
      captureProductEvent({ name: "v2_account_page_viewed", properties: { surface: section } });
    }
  }, [pathname]);
  useEffect(() => {
    const sync = () => { if (document.visibilityState === "visible") void refresh(); };
    const timer = window.setInterval(sync, 60_000);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("note-ready", sync);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("note-ready", sync);
      request.current?.abort();
    };
  }, [refresh]);

  return <Context.Provider value={{ stats, loading, error, refresh }}>
    {children}
    {celebration !== null && <aside className="streak-celebration" aria-label="Pencapaian streak">
      <span className="streak-celebration-icon" aria-hidden="true"><Flame size={30} /></span>
      <div>
        <p role="status"><strong>{celebration} hari berturut-turut!</strong> Kamu menjaga ritme belajarmu.</p>
        <Link href="/dashboard-v2/aktivitas" onClick={() => setCelebration(null)}>Lihat aktivitas</Link>
      </div>
      <button type="button" aria-label="Tutup perayaan streak" onClick={() => setCelebration(null)}><X size={19} /></button>
    </aside>}
  </Context.Provider>;
}
