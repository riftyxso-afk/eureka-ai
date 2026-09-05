"use client";

/**
 * Dashboard Keamanan AI — metrik guardrails NVIDIA NIM + event log.
 * Hanya untuk admin (SAFETY_ADMIN_USER_IDS); selain itu tampil "Akses ditolak".
 */
import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import CardClay from "@/components/ui/CardClay";

interface SafetyMetrics {
  totalInputChecks: number;
  totalOutputChecks: number;
  blockedInputs: number;
  blockedOutputs: number;
  scrubbedOutputs: number;
  jailbreakDetections: number;
  topicRedirects: number;
  nimErrors: number;
  nimFallbacks: number;
  byCategory: Record<string, number>;
}

interface SafetyEvent {
  at: string;
  type: string;
  severity: string;
  categories: string[];
  snippet: string;
  source: string;
}

export default function KeamananPage() {
  const [metrics, setMetrics] = useState<SafetyMetrics | null>(null);
  const [events, setEvents] = useState<SafetyEvent[]>([]);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const userId = getUserId();
      const res = await apiFetch(`/api/safety/metrics?userId=${encodeURIComponent(userId)}`);
      if (res.status === 403) {
        setDenied(true);
        return;
      }
      const json = (await res.json()) as {
        ok?: boolean;
        metrics?: SafetyMetrics;
        events?: SafetyEvent[];
      };
      if (json.ok) {
        setMetrics(json.metrics ?? null);
        setEvents(json.events ?? []);
      } else {
        setDenied(true);
      }
    } catch {
      setDenied(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <CardClay>
          <p className="text-sm font-semibold text-clay-muted">Memuat metrik keamanan…</p>
        </CardClay>
      </main>
    );
  }

  if (denied || !metrics) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <CardClay>
          <div className="flex items-start gap-3">
            <ShieldAlert size={20} className="mt-0.5 shrink-0 text-clay-danger" />
            <div>
              <h1 className="text-lg font-extrabold">Akses ditolak</h1>
              <p className="mt-1 text-sm font-semibold text-clay-muted">
                Halaman ini hanya untuk admin keamanan. Minta admin menambahkan
                user ID kamu ke SAFETY_ADMIN_USER_IDS.
              </p>
            </div>
          </div>
        </CardClay>
      </main>
    );
  }

  const cards: { label: string; value: number }[] = [
    { label: "Cek input", value: metrics.totalInputChecks },
    { label: "Cek output", value: metrics.totalOutputChecks },
    { label: "Input diblokir", value: metrics.blockedInputs },
    { label: "Output diblokir", value: metrics.blockedOutputs },
    { label: "Output di-scrub", value: metrics.scrubbedOutputs },
    { label: "Jailbreak terdeteksi", value: metrics.jailbreakDetections },
    { label: "Redirect topik", value: metrics.topicRedirects },
    { label: "NIM error / fallback", value: metrics.nimErrors + metrics.nimFallbacks },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <ShieldCheck size={20} className="text-clay-success" />
        <h1 className="text-2xl font-extrabold">Keamanan AI</h1>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <CardClay key={c.label}>
            <p className="text-2xl font-extrabold">{c.value}</p>
            <p className="mt-1 text-xs font-bold text-clay-muted">{c.label}</p>
          </CardClay>
        ))}
      </div>
      <CardClay className="mt-6">
        <h2 className="text-lg font-extrabold">Event terakhir</h2>
        {events.length === 0 ? (
          <p className="mt-2 text-sm font-semibold text-clay-muted">
            Belum ada event keamanan tercatat.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {events.map((e, i) => (
              <li key={`${e.at}-${i}`} className="rounded-clay-md bg-clay-beige/60 px-3 py-2 text-xs">
                <span className="font-extrabold">{e.type}</span>
                <span className="ml-2 font-bold text-clay-muted">
                  {e.severity} · {e.source} · {e.categories.join(", ") || "—"}
                </span>
                {e.snippet ? <p className="mt-1 font-semibold">{e.snippet}</p> : null}
                <p className="mt-0.5 text-[11px] text-clay-muted">{e.at}</p>
              </li>
            ))}
          </ul>
        )}
      </CardClay>
    </main>
  );
}
