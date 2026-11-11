"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { FaceSticker } from "stick-it-up";
import { useTheme } from "@/context/ThemeContext";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import type { ProgressStats } from "@/lib/progress-store";
import type { Contribution } from "@/components/amicro/MonoActivityHeatmap";
import "./learning-overview.css";

const ActivityHeatmap = dynamic(() => import("@/components/amicro/MonoActivityHeatmap")
  .then(module => module.MonoActivityHeatmap));

export default function ActivityCalendar({ stats, refresh }: {
  stats: ProgressStats;
  refresh: () => Promise<void>;
}) {
  const { resolved } = useTheme();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const { today, activeToday } = stats.streakDetails;
  const days = useMemo<Contribution[]>(() => {
    const active = new Set(stats.activeDays ?? stats.streakDetails.week.filter(day => day.active).map(day => day.date));
    const lastDay = Date.parse(today);
    return Array.from({ length: 140 }, (_, index) => {
      const date = new Date(lastDay - (139 - index) * 86_400_000).toISOString().slice(0, 10);
      const attended = active.has(date);
      return { date, count: attended ? 1 : 0, level: attended ? 4 : 0 };
    });
  }, [stats, today]);

  async function checkIn() {
    if (checking || activeToday) return;
    setChecking(true);
    setError("");
    try {
      const response = await apiFetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: getUserId(), action: "check_in" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Absen belum tersimpan.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Absen belum tersimpan.");
    } finally {
      setChecking(false);
    }
  }

  return <section className="learning-panel activity-calendar" aria-labelledby="activity-calendar-title">
    <div className="learning-heading">
      <div>
        <h2 id="activity-calendar-title">Kalender kehadiran</h2>
        <p>Aktivitas 20 pekan terakhir. Hari belajar mengikuti WIB.</p>
      </div>
      <span className="learning-sticker" aria-hidden="true"><FaceSticker size={62} peel /></span>
    </div>
    <ActivityHeatmap data={days} theme={resolved} accentColor="purple" compact streak={stats.streak} />
    {error && <p className="learning-error" role="alert">{error}</p>}
    <div className="learning-footer">
      <button className="learning-action" disabled={checking || activeToday} onClick={() => void checkIn()}>
        {checking ? "Menyimpan…" : activeToday ? "Kehadiran hari ini tercatat" : "Absen hari ini"}
      </button>
    </div>
  </section>;
}
