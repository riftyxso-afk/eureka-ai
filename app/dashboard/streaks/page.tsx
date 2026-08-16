"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Crown,
  Flame,
  Star,
  Target,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { getUserId } from "@/lib/identity";

interface Milestone {
  day: number;
  label: string;
  achieved: boolean;
}

interface ActivityEntry {
  date: string;
  xp: number;
  label: string;
}

const MILESTONE_DEFS: { day: number; label: string; icon: LucideIcon }[] = [
  { day: 3, label: "Mulai Konsisten", icon: Flame },
  { day: 7, label: "Pekan Pertama", icon: Star },
  { day: 14, label: "Dua Pekan", icon: Target },
  { day: 30, label: "Sebulan Penuh", icon: Trophy },
  { day: 100, label: "Legenda", icon: Crown },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

export default function StreaksPage() {
  const [stats, setStats] = useState({
    currentStreak: 0,
    longestStreak: 0,
    totalXP: 0,
    level: 1,
    levelTitle: "PELAJAR KONSISTEN",
    totalNotes: 0,
    recentActivity: [] as ActivityEntry[],
  });

  const loadStats = useCallback(async () => {
    try {
      const userId = getUserId();
      const [progressRes, notesRes] = await Promise.all([
        apiFetch(`/api/progress?userId=${encodeURIComponent(userId)}`),
        apiFetch(`/api/notes?userId=${encodeURIComponent(userId)}`),
      ]);
      if (progressRes.ok) {
        const payload = await progressRes.json();
        if (payload.stats) {
          const s = payload.stats;
          setStats((prev) => ({
            ...prev,
            currentStreak: s.streak,
            longestStreak: s.longestStreak,
            totalXP: s.xp,
            level: s.level,
            levelTitle: s.levelTitle,
            recentActivity: s.recentActivity ?? [],
          }));
        }
      }
      if (notesRes.ok) {
        const payload = await notesRes.json();
        setStats((prev) => ({
          ...prev,
          totalNotes: Array.isArray(payload.notes) ? payload.notes.length : 0,
        }));
      }
    } catch {
      // biarkan nilai awal
    }
  }, []);

  useEffect(() => {
    loadStats();
    const timer = setInterval(loadStats, 15000);
    return () => clearInterval(timer);
  }, [loadStats]);

  const milestones: (Milestone & { icon: LucideIcon })[] = MILESTONE_DEFS.map(
    (m) => ({
      day: m.day,
      label: m.label,
      icon: m.icon,
      achieved: stats.currentStreak >= m.day,
    })
  );

  const cards = [
    { icon: TrendingUp, label: "Total XP", value: stats.totalXP },
    { icon: Award, label: "Level", value: stats.level },
    { icon: BookOpen, label: "Total Catatan", value: stats.totalNotes },
  ];

  return (
    <div className="mx-auto w-full max-w-clay px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Streaks</h1>
      <p className="mt-2 text-base font-semibold text-clay-muted">
        Pertahankan ritme belajarmu setiap hari
      </p>

      {/* Hero Card */}
      <div className="card-clay mt-6 flex flex-col items-center py-10 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-clay-primary/10 shadow-clay-inset">
          <Flame size={40} className="text-clay-primary" />
        </div>
        <p className="mt-6 text-6xl font-extrabold text-clay-primary">
          {stats.currentStreak}
        </p>
        <p className="mt-2 text-base font-bold text-clay-muted">
          Hari Berturut-turut
        </p>
        <p className="mt-1 text-sm font-bold text-clay-muted">
          Terpanjang: {stats.longestStreak} hari
        </p>
        <span className="mt-4 inline-block rounded-clay-full border-2 border-clay-primary bg-clay-primary/10 px-5 py-1.5 text-sm font-extrabold text-clay-primary">
          {stats.levelTitle}
        </span>
      </div>

      {/* Statistik cepat */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((s) => (
          <div key={s.label} className="card-clay flex flex-col items-center gap-1 !p-4 text-center sm:!p-5">
            <s.icon size={18} className="text-clay-primary sm:hidden" />
            <s.icon size={20} className="hidden text-clay-primary sm:block" />
            <p className="text-xl font-extrabold sm:text-2xl">
              {s.value.toLocaleString("id-ID")}
            </p>
            <p className="text-xs font-bold text-clay-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Milestone */}
      <h2 className="mt-10 text-base font-extrabold text-clay-dark sm:text-lg">Capaian (Milestone)</h2>
      <div className="mt-4 flex flex-col gap-3">
        {milestones.map((m) => (
          <div
            key={m.day}
            className={`card-clay flex items-center gap-4 !p-4 !shadow-clay-sm ${
              m.achieved ? "" : "opacity-70"
            }`}
          >
            {m.achieved ? (
              <CheckCircle2 size={22} className="shrink-0 text-clay-success" />
            ) : (
              <Clock size={22} className="shrink-0 text-clay-muted" />
            )}
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
              <span className="flex items-center gap-2 truncate text-base font-bold text-clay-dark">
                <m.icon size={16} className="shrink-0 text-clay-primary" />
                {m.label}
              </span>
              <span className="shrink-0 rounded-clay-full bg-clay-inputBg px-3 py-1 text-xs font-extrabold text-clay-muted shadow-clay-inset">
                Hari ke-{m.day}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Aktivitas terakhir */}
      <h2 className="mt-10 text-base font-extrabold text-clay-dark sm:text-lg">Aktivitas Terakhir</h2>
      <div className="card-clay mt-4 !p-2">
        {stats.recentActivity.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm font-semibold text-clay-muted">
            Belum ada aktivitas. Mulai belajar untuk mengumpulkan XP!
          </p>
        ) : (
          stats.recentActivity.map((a, i) => (
            <div
              key={`${a.date}-${i}`}
              className="flex items-center justify-between gap-3 px-4 py-3.5 even:bg-clay-beige/60"
            >
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-clay-dark">{a.label}</p>
                <p className="text-sm font-bold text-clay-muted">{formatDate(a.date)}</p>
              </div>
              <span className="shrink-0 text-base font-extrabold text-clay-primary">
                +{a.xp} XP
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
