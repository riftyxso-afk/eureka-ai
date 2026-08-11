import type { ReactNode } from "react";

interface CardClayProps {
  className?: string;
  children: ReactNode;
}

export default function CardClay({ className = "", children }: CardClayProps) {
  return <div className={`card-clay ${className}`}>{children}</div>;
}
