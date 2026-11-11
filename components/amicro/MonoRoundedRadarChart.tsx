"use client";
// Adapted from Amicro by Syed Subhan Uddin. See LICENSE.
import React from 'react';
import { motion } from 'motion/react';
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
} from 'recharts';


interface RadarPoint {
  subject: string;
  metric: number;
}



interface MonoRoundedRadarChartProps {
  theme?: 'dark' | 'light';
  compact?: boolean;
  data: RadarPoint[];
}

export function MonoRoundedRadarChart({ theme = 'dark', compact = false, data }: MonoRoundedRadarChartProps) {
  const isDark = theme === 'dark';

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`relative w-full rounded-3xl transition-all duration-250 group flex flex-col justify-between overflow-hidden p-3.5 sm:p-4 ${
        compact ? 'aspect-[16/10] min-h-[220px] w-full' : 'min-h-[290px]'
      } ${
        isDark ? 'bg-[#141414] border border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:border-white/20' : 'bg-white shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-neutral-200 text-black hover:border-neutral-300'
      }`}
    >
      {/* Metric Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-baseline gap-2">
          <div className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums font-sans">
            {Math.round(data.reduce((sum, item) => sum + item.metric, 0) / Math.max(data.length, 1))} <span className="text-xs font-normal opacity-70">/ 100</span>
          </div>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono border ${
            isDark ? 'bg-white/5 text-neutral-300 border-white/10' : 'bg-neutral-100 text-neutral-700 border-neutral-200'
          }`}>
            Progres aktivitas
          </span>
        </div>

        <div className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono ${
          isDark ? 'bg-white/5 text-neutral-400' : 'bg-neutral-100 text-neutral-600'
        }`}>
          {data.length} pelajaran
        </div>
      </div>

      {/* Main Stage */}
      <div className={`relative w-full flex-1 rounded-[14px] overflow-hidden p-2 transition-colors min-h-0 duration-250 flex items-center justify-center ${
        isDark ? 'bg-[#131313]' : 'bg-[#f4f4f6]'
      }`}>
        <ResponsiveContainer width="100%" height={250}>
          <RadarChart cx="50%" cy="50%" outerRadius="65%" data={data}>
            <PolarGrid stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9.5, fill: isDark ? '#A1A1AA' : '#52525B' }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Tooltip formatter={value => [`${value}%`, "Progres aktivitas"]} contentStyle={{ background: isDark ? "#242424" : "#fff", color: isDark ? "#eee" : "#222", borderRadius: 12, border: "none" }} />
            <Radar
              name="Progres aktivitas"
              dataKey="metric"
              stroke={isDark ? '#FFFFFF' : '#09090B'}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(9,9,11,0.18)'}
              isAnimationActive={false}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
