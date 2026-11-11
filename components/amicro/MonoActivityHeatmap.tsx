"use client";
// Adapted from Amicro by Syed Subhan Uddin. See LICENSE.
import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
const cn = (...values: (string | false | undefined)[]) => values.filter(Boolean).join(' ');

export type ContributionLevel = 0 | 1 | 2 | 3 | 4;

export type Contribution = {
  date: string;
  count: number;
  level: ContributionLevel;
};

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

interface MonoActivityHeatmapProps {
  theme?: 'dark' | 'light';
  accentColor?: 'green' | 'blue' | 'purple' | 'mono';
  compact?: boolean;
  data: Contribution[];
  streak?: number;
}

function toWeeks(contributions: Contribution[]) {
  const weeks: Contribution[][] = [];
  for (let i = 0; i < contributions.length; i += 7) {
    weeks.push(contributions.slice(i, i + 7));
  }
  return weeks;
}

export function MonoActivityHeatmap({
  theme = 'dark',
  accentColor = 'green',
  compact = false,
  data,
  streak = 0,
}: MonoActivityHeatmapProps) {
  const isDark = theme === 'dark';
  const [hoveredDay, setHoveredDay] = useState<Contribution | null>(null);

  const contributions = data;
  const weeks = useMemo(() => toWeeks(contributions), [contributions]);


  const colorScale = useMemo(() => {
    const monoBadge = isDark
      ? 'bg-white/5 text-neutral-300 border-white/10'
      : 'bg-neutral-100 text-neutral-700 border-neutral-200';
    switch (accentColor) {
      case 'green':
        return {
          bg: '#39d353',
          badgeText: 'Emerald Matrix',
          badgePill: monoBadge,
        };
      case 'blue':
        return {
          bg: '#38bdf8',
          badgeText: 'Sky Matrix',
          badgePill: monoBadge,
        };
      case 'purple':
        return {
          bg: '#c084fc',
          badgeText: 'Violet Pulse',
          badgePill: monoBadge,
        };
      case 'mono':
      default:
        return {
          bg: isDark ? '#FFFFFF' : '#09090B',
          badgeText: 'Monochrome',
          badgePill: monoBadge,
        };
    }
  }, [accentColor, isDark]);

  const opacityForLevel = (lvl: ContributionLevel) => {
    switch (lvl) {
      case 0: return isDark ? 0.06 : 0.08;
      case 1: return 0.3;
      case 2: return 0.55;
      case 3: return 0.8;
      case 4: return 1;
    }
  };

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'relative w-full rounded-3xl transition-all duration-250 group flex flex-col justify-between overflow-hidden p-3.5 sm:p-4 font-sans',
        compact ? 'aspect-[16/10] min-h-[220px] w-full' : 'min-h-[290px]',
        isDark ? 'bg-[#141414] border border-white/[0.08] text-white shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:border-white/20' : 'bg-white shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-neutral-200 text-black hover:border-neutral-300'
      )}
    >
      {/* Metric Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-baseline gap-2">
          <div className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums font-sans">
            {contributions.filter(day => day.count > 0).length} <span className="text-xs font-normal opacity-70">hari aktif</span>
          </div>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono border ${colorScale.badgePill}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-white/60' : 'bg-black/60'}`} />
            {streak} hari streak
          </span>
        </div>

        <div className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono ${
          isDark ? 'bg-white/5 text-neutral-400' : 'bg-neutral-100 text-neutral-600'
        }`}>
          {weeks.length} pekan
        </div>
      </div>

      {/* Main Heatmap Stage Grid */}
      <div className={cn(
        'relative w-full flex-1 rounded-[14px] overflow-hidden p-2.5 sm:p-3 transition-colors duration-250 flex flex-col justify-between items-center min-h-0',
        isDark ? 'bg-[#131313]' : 'bg-[#f4f4f6]'
      )}>
        {/* Month Headers */}
        <div className="flex justify-between items-center w-full px-1 mb-1">
          {Array.from(new Set(contributions.map(day => MONTH_NAMES[new Date(day.date).getUTCMonth()]))).map((m, idx) => (
            <span key={idx} className={`text-[10px] font-mono text-center flex-1 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              {m}
            </span>
          ))}
        </div>

        {/* 20-Week Heatmap Grid */}
        <div
          className="flex justify-between items-center gap-[2px] sm:gap-[3px] w-full py-0.5"
          data-heatmap onPointerLeave={() => setHoveredDay(null)}
        >
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="flex flex-col gap-[2px] sm:gap-[3px] items-center flex-1">
              {week.map((day, dIdx) => (
                <motion.button
                  type="button"
                  data-heat-day={day.date}
                  tabIndex={(hoveredDay?.date ?? contributions[contributions.length - 1]?.date) === day.date ? 0 : -1}
                  aria-label={`${day.date}: ${day.count > 0 ? "Aktif" : "Belum aktif"}`}
                  onFocus={() => setHoveredDay(day)}
                  onBlur={() => setHoveredDay(null)}
                  onKeyDown={event => {
                    const offset = ({ ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 } as Record<string, number>)[event.key];
                    if (offset === undefined) return;
                    event.preventDefault();
                    const next = Math.max(0, Math.min(contributions.length - 1, wIdx * 7 + dIdx + offset));
                    setHoveredDay(contributions[next]);
                    const buttons = event.currentTarget.closest('[data-heatmap]')?.querySelectorAll<HTMLButtonElement>('[data-heat-day]');
                    buttons?.[next]?.focus();
                  }}
                  key={`${wIdx}-${dIdx}`}
                  onPointerEnter={() => setHoveredDay(day)}
                  onPointerDown={() => setHoveredDay(day)}
                  className="aspect-square w-full rounded-[2px] sm:rounded-[2.5px] transition-all cursor-pointer"
                  style={{
                    backgroundColor: colorScale.bg,
                    opacity: opacityForLevel(day.level),
                  }}
                  whileHover={{ scale: 1.35, zIndex: 10 }}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Active Cell Tooltip Callout */}
        <div className="h-4 flex items-center justify-center">
          {hoveredDay ? (
            <span className={`text-[10px] sm:text-[11px] font-mono font-medium ${isDark ? 'text-neutral-200' : 'text-neutral-800'}`}>
              {hoveredDay.date}: {hoveredDay.count > 0 ? 'Aktivitas tercatat' : 'Belum ada aktivitas'}
            </span>
          ) : (
            <span className={`text-[10px] font-mono opacity-40 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Sentuh tanggal untuk melihat kehadiran
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
