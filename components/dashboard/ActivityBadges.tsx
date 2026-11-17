import { Award, BookOpen, CalendarDays, Flame, Gem, GraduationCap, LockKeyhole, Rocket, Sparkles, Star, Trophy, Zap } from "lucide-react";
import type { CSSProperties } from "react";
import type { ProgressStats } from "@/lib/progress-store";
import "./activity-badges.css";

const badges = [
  { id: "first-day", name: "Langkah pertama", goal: "1 hari aktif", metric: "totalDays", target: 1, icon: Rocket, color: "#9b5aff", shade: "#452490", shape: "round" },
  { id: "streak-3", name: "Mulai konsisten", goal: "Streak 3 hari", metric: "longestStreak", target: 3, icon: Flame, color: "#ffad53", shade: "#af3613", shape: "shield" },
  { id: "streak-7", name: "Pekan pertama", goal: "Streak 7 hari", metric: "longestStreak", target: 7, icon: CalendarDays, color: "#5ee5dd", shade: "#087e79", shape: "hex" },
  { id: "xp-100", name: "Naik tenaga", goal: "100 XP", metric: "xp", target: 100, icon: Zap, color: "#ffc775", shade: "#a8580f", shape: "round" },
  { id: "active-10", name: "Pembaca tekun", goal: "10 hari aktif", metric: "totalDays", target: 10, icon: BookOpen, color: "#73b4ff", shade: "#1555be", shape: "shield" },
  { id: "streak-14", name: "Dua pekan", goal: "Streak 14 hari", metric: "longestStreak", target: 14, icon: Star, color: "#ff8fa9", shade: "#a82c6d", shape: "hex" },
  { id: "xp-500", name: "Bintang belajar", goal: "500 XP", metric: "xp", target: 500, icon: Sparkles, color: "#8b85ff", shade: "#4228a6", shape: "round" },
  { id: "active-30", name: "Jejak belajar", goal: "30 hari aktif", metric: "totalDays", target: 30, icon: Award, color: "#7cda89", shade: "#257238", shape: "shield" },
  { id: "streak-30", name: "Sebulan penuh", goal: "Streak 30 hari", metric: "longestStreak", target: 30, icon: Trophy, color: "#ffd76b", shade: "#a66a0a", shape: "hex" },
  { id: "xp-1000", name: "Pencari ilmu", goal: "1.000 XP", metric: "xp", target: 1000, icon: GraduationCap, color: "#9fc7ff", shade: "#3c4aac", shape: "round" },
  { id: "active-100", name: "Seratus langkah", goal: "100 hari aktif", metric: "totalDays", target: 100, icon: Gem, color: "#f385ff", shade: "#8325ae", shape: "shield" },
  { id: "streak-100", name: "Legenda belajar", goal: "Streak 100 hari", metric: "longestStreak", target: 100, icon: Trophy, color: "#f8a179", shade: "#ac3526", shape: "hex" },
] as const;

type Badge = (typeof badges)[number];

function BadgeEmblem({ badge, earned, index = 0 }: { badge: Badge; earned: boolean; index?: number }) {
  const Icon = badge.icon;
  const colors = { "--badge-color": badge.color, "--badge-shade": badge.shade, "--badge-delay": `${index * 24}ms` } as CSSProperties;
  return <span className="activity-badge-emblem" data-shape={badge.shape} data-earned={earned} style={colors} aria-hidden="true">
    <span className="activity-badge-medal"><Icon strokeWidth={2} /><span className="activity-badge-glint" /></span>
    {!earned && <LockKeyhole className="activity-badge-lock" />}
  </span>;
}

export function StreakBadgeEmblem({ days }: { days: number }) {
  const badge = badges.find(item => item.metric === "longestStreak" && item.target === days);
  return badge ? <BadgeEmblem badge={badge} earned /> : null;
}

export default function ActivityBadges({ stats }: { stats: ProgressStats }) {
  const earnedCount = badges.filter(badge => stats[badge.metric] >= badge.target).length;
  return <section className="account-surface activity-badges" aria-labelledby="activity-badges-title">
    <header className="activity-badges-header">
      <div>
        <h2 id="activity-badges-title">Koleksi badge</h2>
        <p>Kumpulkan badge dari hari aktif, streak, dan XP.</p>
      </div>
      <span role="status">{earnedCount}/{badges.length} terbuka</span>
    </header>
    <ul className="activity-badges-grid">
      {badges.map((badge, index) => {
        const earned = stats[badge.metric] >= badge.target;
        return <li key={badge.id} className="activity-badge" data-earned={earned}>
          <BadgeEmblem badge={badge} earned={earned} index={index} />
          <strong>{badge.name}</strong>
          <small>{badge.goal}</small>
          <span className="sr-only">{earned ? "Sudah diperoleh" : "Terkunci"}</span>
        </li>;
      })}
    </ul>
  </section>;
}
