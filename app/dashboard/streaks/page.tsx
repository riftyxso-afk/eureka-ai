"use client";

import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Flame,
  TrendingUp,
} from "lucide-react";

const mockStreakData = {
  currentStreak: 7,
  longestStreak: 15,
  totalXP: 2450,
  level: 3,
  levelTitle: "PELAJAR KONSISTEN",
  milestones: [
    { day: 3, label: "🔥 Mulai Konsisten", achieved: true },
    { day: 7, label: "⭐ Pekan Pertama", achieved: true },
    { day: 14, label: "🎯 Dua Pekan", achieved: false },
    { day: 30, label: "🏆 Sebulan Penuh", achieved: false },
    { day: 100, label: "👑 Legenda", achieved: false },
  ],
  recentActivity: [
    { date: "2026-08-10", xp: 50, note: "Belajar Turunan" },
    { date: "2026-08-09", xp: 30, note: "Review Integral" },
    { date: "2026-08-08", xp: 45, note: "Latihan Soal" },
    { date: "2026-08-07", xp: 20, note: "Membaca Materi" },
  ],
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

export default function StreaksPage() {
  const stats = [
    { icon: TrendingUp, label: "Total XP", value: mockStreakData.totalXP },
    { icon: Award, label: "Level", value: mockStreakData.level },
    { icon: BookOpen, label: "Total Catatan", value: 12 },
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
          {mockStreakData.currentStreak}
        </p>
        <p className="mt-2 text-base font-bold text-clay-muted">
          Hari Berturut-turut
        </p>
        <p className="mt-1 text-sm font-bold text-clay-muted">
          Terpanjang: {mockStreakData.longestStreak} hari
        </p>
        <span className="mt-4 inline-block rounded-clay-full border-2 border-clay-primary bg-clay-primary/10 px-5 py-1.5 text-sm font-extrabold text-clay-primary">
          {mockStreakData.levelTitle}
        </span>
      </div>

      {/* Statistik cepat */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card-clay flex flex-col items-center gap-1 !p-5 text-center">
            <s.icon size={20} className="text-clay-primary" />
            <p className="text-2xl font-extrabold">{s.value}</p>
            <p className="text-xs font-bold text-clay-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Milestone */}
      <h2 className="mt-10 text-lg font-extrabold text-clay-dark">Capaian (Milestone)</h2>
      <div className="mt-4 flex flex-col gap-3">
        {mockStreakData.milestones.map((m) => (
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
              <span className="truncate text-base font-bold text-clay-dark">
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
      <h2 className="mt-10 text-lg font-extrabold text-clay-dark">Aktivitas Terakhir</h2>
      <div className="card-clay mt-4 !p-2">
        {mockStreakData.recentActivity.map((a, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 px-4 py-3.5 even:bg-clay-beige/60"
          >
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-clay-dark">{a.note}</p>
              <p className="text-sm font-bold text-clay-muted">{formatDate(a.date)}</p>
            </div>
            <span className="shrink-0 text-base font-extrabold text-clay-primary">
              +{a.xp} XP
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
