export const STREAK_MILESTONES = [
  { days: 3, label: "Mulai konsisten" },
  { days: 7, label: "Pekan pertama" },
  { days: 14, label: "Dua pekan" },
  { days: 30, label: "Sebulan penuh" },
  { days: 100, label: "Legenda belajar" },
] as const;

const DAY = 86_400_000;
const WIB = 7 * 3_600_000;

export function studyDay(now = Date.now()) {
  return new Date(now + WIB).toISOString().slice(0, 10);
}

function offsetDay(day: string, offset: number) {
  return new Date(Date.parse(day) + offset * DAY).toISOString().slice(0, 10);
}

export function summarizeStreak(dates: string[], now = Date.now()) {
  const today = studyDay(now);
  const activeDays = [...new Set(dates.filter(day => /^\d{4}-\d{2}-\d{2}$/.test(day) && day <= today && Number.isFinite(Date.parse(day))))].sort();
  const active = new Set(activeDays);
  const activeToday = active.has(today);
  const lastEligible = activeToday ? today : offsetDay(today, -1);
  let current = 0;
  while (active.has(offsetDay(lastEligible, -current))) current++;

  let longest = 0;
  let run = 0;
  let previous = -Infinity;
  for (const day of activeDays) {
    const date = Date.parse(day);
    run = date - previous === DAY ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }
  const milestone = [...STREAK_MILESTONES].reverse().find(item => current >= item.days);
  const earnedOn = milestone ? offsetDay(lastEligible, milestone.days - current) : null;
  return {
    current, longest, totalDays: activeDays.length, today, activeToday,
    week: Array.from({ length: 7 }, (_, index) => {
      const date = offsetDay(today, index - 6);
      return { date, active: active.has(date) };
    }),
    celebration: milestone && earnedOn && earnedOn >= offsetDay(today, -1) ? { days: milestone.days, earnedOn } : null,
  };
}

export type StreakSummary = ReturnType<typeof summarizeStreak>;
