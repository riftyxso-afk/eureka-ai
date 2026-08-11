import type { ButtonHTMLAttributes } from "react";

interface ButtonClayProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
}

export default function ButtonClay({
  variant = "primary",
  fullWidth = false,
  className = "",
  children,
  ...rest
}: ButtonClayProps) {
  const base = variant === "primary" ? "btn-clay-primary" : "btn-clay-secondary";
  return (
    <button className={`${base} ${fullWidth ? "w-full" : ""} ${className}`} {...rest}>
      {children}
    </button>
  );
}
