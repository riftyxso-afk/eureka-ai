import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
}

export const StatsCard = ({ icon: Icon, label, value }: StatsCardProps) => {
  return (
    <div className="card-clay flex flex-col items-start gap-1 p-4">
      <div className="flex items-center gap-2 text-clay-muted">
        <Icon size={16} />
        <span className="text-xs font-bold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <span className="text-2xl font-extrabold text-clay-dark">{value}</span>
    </div>
  );
};
