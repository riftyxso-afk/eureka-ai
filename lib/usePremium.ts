"use client";

import { useSyncExternalStore } from "react";
import { apiFetch } from "./apiClient";
import { getUserId } from "./identity";
import { syncAuthSession, isLoggedIn } from "./auth";
import { supabase } from "./supabase/client";
import { FREE_PRO_START } from "./free-pro-period";
import { requestPremiumStatus } from "./premiumRequest";

export const PREMIUM_UPDATED_EVENT = "eureka-premium-updated";

export interface PremiumStatus {
  isPremium: boolean;
  tier: "promo" | "normal" | "trial" | null;
  premiumUntil: string | null;
  freeAccessUntil?: string;
}

const EMPTY: PremiumStatus = { isPremium: false, tier: null, premiumUntil: null };
const INITIAL = { ...EMPTY, loading: true, error: null as string | null };
let snapshot: PremiumStatus & Pick<typeof INITIAL, "loading" | "error"> = INITIAL;
let owner: string | null | undefined;
let verified = false;
let generation = 0;
let started = false;
let authRevision = 0;
let synchronization: Promise<void> | null = null;
let pending: { userId: string; controller: AbortController; promise: Promise<void> } | null = null;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
const subscribers = new Set<() => void>();

function publish(status: PremiumStatus, loading: boolean, error: string | null = null) {
  snapshot = { ...status, loading, error };
  subscribers.forEach(notify => notify());
}

function scheduleExpiry(userId: string, until: string | null) {
  clearTimeout(expiryTimer);
  if (!until || !Number.isFinite(Date.parse(until))) return;
  const check = () => {
    if (owner !== userId) return;
    const remaining = Date.parse(until) - Date.now();
    if (remaining <= 0) void loadForUser(userId, true);
    else expiryTimer = setTimeout(check, Math.min(remaining, 2_147_483_647));
  };
  expiryTimer = setTimeout(check, Math.max(1, Math.min(Date.parse(until) - Date.now(), 2_147_483_647)));
}

function loadForUser(userId: string | null, force = false): Promise<void> {
  if (owner !== userId) {
    generation++;
    pending?.controller.abort();
    pending = null;
    clearTimeout(expiryTimer);
    owner = userId;
    verified = false;
    publish(EMPTY, Boolean(userId));
  }
  if (!userId) {
    verified = true;
    publish(EMPTY, false);
    return Promise.resolve();
  }
  if (pending?.userId === userId) return pending.promise;
  if (verified && !force) return Promise.resolve();
  if (snapshot.error) publish(EMPTY, true);

  const version = generation;
  const controller = new AbortController();
  const promise = (async () => {
    try {
      const data = await requestPremiumStatus(
        () => apiFetch("/api/payments/status", { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) }),
        async () => {
          if (!supabase) return false;
          const { data, error } = await supabase.auth.refreshSession();
          return !error && data.session?.user.id === userId;
        }, controller.signal,
      ) as Partial<PremiumStatus> & { userId?: string };
      if (version !== generation || controller.signal.aborted) return;
      if (data.userId && data.userId !== userId) throw new Error("Sesi akun berubah. Silakan muat ulang halaman.");
      const status: PremiumStatus = {
        isPremium: data.isPremium === true,
        tier: data.tier ?? null,
        premiumUntil: data.premiumUntil ?? null,
        freeAccessUntil: data.freeAccessUntil,
      };
      verified = true;
      publish(status, false);
      const now = Date.now();
      const nextChange = [status.isPremium ? status.premiumUntil : null, status.freeAccessUntil, FREE_PRO_START]
        .filter((date): date is string => Boolean(date && Date.parse(date) > now))
        .sort((a, b) => Date.parse(a) - Date.parse(b))[0];
      scheduleExpiry(userId, nextChange ?? null);
    } catch (cause) {
      if (version !== generation || controller.signal.aborted) return;
      verified = false;
      publish(EMPTY, false, cause instanceof Error && cause.message.startsWith("Sesi akun") ? cause.message : "Status paket belum bisa dimuat. Silakan coba lagi.");
    } finally {
      if (pending?.controller === controller) pending = null;
    }
  })();
  pending = { userId, controller, promise };
  return promise;
}

function synchronize(force: boolean): Promise<void> {
  if (synchronization) return synchronization;
  synchronization = (async () => {
    await syncAuthSession().catch(() => undefined);
    await loadForUser(isLoggedIn() ? getUserId() : null, force);
  })().finally(() => { synchronization = null; });
  return synchronization;
}

function subscribe(notify: () => void) {
  subscribers.add(notify);
  if (!started && typeof window !== "undefined") {
    started = true;
    window.addEventListener(PREMIUM_UPDATED_EVENT, refreshPremium);
    const recover = () => { if (snapshot.error && !pending) void synchronize(true); };
    window.addEventListener("online", recover);
    window.addEventListener("focus", recover);
    supabase?.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") { authRevision++; void loadForUser(null); }
      else if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        const revision = ++authRevision;
        // Run outside the auth callback so Supabase can release its session lock.
        setTimeout(() => { if (revision === authRevision) void loadForUser(session?.user.id ?? null); }, 0);
      }
    });
    void synchronize(false);
  }
  return () => { subscribers.delete(notify); };
}

function refreshPremium() {
  return synchronize(true);
}

/** One verified snapshot per signed-in account, shared across components and routes. */
export function usePremium() {
  const status = useSyncExternalStore(subscribe, () => snapshot, () => INITIAL);
  return { ...status, refresh: refreshPremium };
}
