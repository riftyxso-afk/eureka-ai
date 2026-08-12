import { GraduationCap } from "lucide-react";

interface AvatarClayProps {
  name?: string;
  size?: number;
}

export default function AvatarClay({ size = 48 }: AvatarClayProps) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-clay-primary text-white border-2 border-clay-borderLight shadow-clay-sm"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <GraduationCap size={Math.round(size * 0.52)} strokeWidth={2.4} />
    </div>
  );
}
