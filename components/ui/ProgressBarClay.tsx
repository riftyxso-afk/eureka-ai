interface ProgressBarClayProps {
  value: number;
  max?: number;
  className?: string;
}

export default function ProgressBarClay({
  value,
  max = 5,
  className = "",
}: ProgressBarClayProps) {
  const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  return (
    <div className={`relative h-6 w-full ${className}`}>
      <div className="absolute inset-0 rounded-full bg-clay-inputBg shadow-clay-inset" />
      <div
        className="relative h-full rounded-full bg-gradient-to-r from-clay-primary to-clay-borderLight transition-all duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
      <div
        className="absolute top-[-6px] h-8 w-8 rounded-full bg-clay-secondary border-2 border-clay-borderLight shadow-clay-thumb transition-all duration-500 ease-out"
        style={{ left: `calc(${pct}% - 16px)` }}
      />
    </div>
  );
}
