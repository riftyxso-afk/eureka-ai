"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { normalizeDashboardNotes } from "@/lib/dashboard-notes";
import type { Note } from "@/lib/types";

export function useDashboardNotes(enabled: boolean) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    if (!enabled) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const owner = getUserId();
    setStatus("loading"); setError("");
    try {
      const response = await apiFetch(`/api/notes?userId=${encodeURIComponent(owner)}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Catatan belum bisa dimuat.");
      if (controller.signal.aborted || owner !== getUserId()) return;
      setNotes(normalizeDashboardNotes(result.notes));
    } catch (cause) {
      if (!controller.signal.aborted && owner === getUserId()) setError(cause instanceof Error ? cause.message : "Catatan belum bisa dimuat.");
    } finally { if (!controller.signal.aborted && owner === getUserId()) setStatus("ready"); }
  }, [enabled]);
  useEffect(() => {
    if (enabled) void load();
    else { setNotes([]); setError(""); setStatus("idle"); }
    const refresh = () => { void load(); };
    window.addEventListener("note-ready", refresh);
    return () => { request.current?.abort(); window.removeEventListener("note-ready", refresh); };
  }, [enabled, load]);
  return { notes, loading: enabled && status !== "ready", error, refresh: load };
}
