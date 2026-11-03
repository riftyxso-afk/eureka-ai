import type { ReactNode } from "react";
export interface VoicePillProps {
  accentColor?: string; iconColor?: string; background?: string; size?: number; shape?: "pill" | "rounded";
  reactive?: "mic" | "simulated"; disabled?: boolean; ariaLabel?: string; maxDuration?: number;
  onStart?: (event: { source: string; stream?: MediaStream }) => void;
  onStop?: (event: { reason: string; duration: number }) => void; className?: string;
}
export default function VoicePill(props: VoicePillProps): ReactNode;
