"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Check, Flame, LockKeyhole, Trophy, Zap } from "lucide-react";
import V2FeaturePage from "@/components/dashboard/V2FeaturePage";
import ActivityCalendar from "@/components/dashboard/ActivityCalendar";
import { useV2Progress } from "@/components/dashboard/V2Progress";
import { STREAK_MILESTONES } from "@/lib/streak";

const formatDay = new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "UTC" });
const formatDate = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });

export default function Page() {
  const { stats, loading, error, refresh } = useV2Progress();
  const detail = stats?.streakDetails;
  const current = stats?.streak ?? 0;
  const longest = stats?.longestStreak ?? 0;
  const next = STREAK_MILESTONES.find(item => item.days > current);
  const number = (value: number) => value.toLocaleString("id-ID");

  return <V2FeaturePage title="Progres belajar" art={9} guide="streaks">
    <main className="streak-page">
      <header className="streak-heading">
        <h1>Aktivitas belajar</h1>
        <p>Catat kehadiran, lihat riwayat belajar, dan ikuti target streak.</p>
      </header>
      {loading ? <div className="streak-skeleton" role="status" aria-label="Memuat progres streak"><span /><span /><span /></div>
        : !stats ? <section className="account-surface streak-empty" role="alert">
          <p>{error || "Progres belum bisa dimuat."}</p><button className="dv2-button" onClick={() => void refresh()}>Coba lagi</button>
        </section> : <>
          <section className="streak-hero">
            <div>
              <p className="streak-kicker"><Flame size={18} /> Streak aktif</p>
              <p className="streak-score"><strong>{number(current)}</strong><span>hari berturut-turut</span></p>
              <p>{detail?.activeToday ? "Aktivitas hari ini sudah tercatat." : current ? "Belajar hari ini untuk menjaga streak." : "Selesaikan satu aktivitas belajar untuk menyalakan streak."}</p>
              {!detail?.activeToday && <Link className="dv2-button" href="/dashboard-v2">Mulai belajar <ArrowRight size={16} /></Link>}
            </div>
            <span className="streak-flame" data-lit={current > 0} aria-hidden="true"><Flame strokeWidth={1.45} /></span>
          </section>
          <div className="streak-quick-stats">
            <div className="account-surface"><Trophy size={20} /><span>Rekor streak</span><strong>{number(longest)} hari</strong></div>
            <div className="account-surface"><CalendarDays size={20} /><span>Total hari aktif</span><strong>{number(stats.totalDays)} hari</strong></div>
            <div className="account-surface"><Zap size={20} /><span>Total XP</span><strong>{number(stats.xp)}</strong></div>
          </div>
          <ActivityCalendar stats={stats} refresh={refresh} />
          <div className="streak-panels">
            <section className="account-surface">
              <h2>Tujuh hari terakhir</h2>
              <p className="streak-subtext">Hari belajar mengikuti WIB.</p>
              {detail ? <ol className="streak-week">{detail.week.map(day => <li key={day.date} data-active={day.active} aria-current={day.date === detail.today ? "date" : undefined}>
                <span>{formatDay.format(new Date(day.date))}</span>
                <strong>{day.date.slice(-2)}</strong>
                {day.active ? <Check size={15} aria-label="Aktif" /> : <span className="streak-day-dot" aria-label="Belum aktif" />}
              </li>)}</ol> : <p className="streak-subtext">Kalender streak belum tersedia.</p>}
              <h2 className="streak-history-title">Aktivitas terakhir</h2>
              {stats.recentActivity.length ? <ul className="streak-history">{stats.recentActivity.slice(0, 5).map((entry, index) => <li key={`${entry.date}:${index}`}>
                <div><strong>{entry.label}</strong><small>{formatDate.format(new Date(entry.date))}</small></div><span>+{number(entry.xp)} XP</span>
              </li>)}</ul> : <p className="streak-subtext">Aktivitas yang menghasilkan XP akan muncul di sini.</p>}
            </section>
            <section className="account-surface">
              <h2>Target streak</h2>
              {next ? <><p className="streak-subtext">{next.days - current} hari lagi menuju {next.label.toLowerCase()}.</p>
                <progress className="streak-meter" value={current} max={next.days} aria-label="Progres menuju target berikutnya" /></>
                : <p className="streak-subtext">Semua target streak sudah tercapai.</p>}
              <ol className="streak-targets">{STREAK_MILESTONES.map(item => <li key={item.days}>
                <span className="streak-target-icon" data-earned={longest >= item.days}>{longest >= item.days ? <Check size={17} aria-label="Pernah tercapai" /> : <LockKeyhole size={16} aria-label="Belum tercapai" />}</span>
                <strong>{item.label}</strong><span>{item.days} hari</span>
              </li>)}</ol>
            </section>
          </div>
        </>}
    </main>
  </V2FeaturePage>;
}
