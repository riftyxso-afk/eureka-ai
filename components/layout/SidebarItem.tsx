"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  href: string;
  active?: boolean;
  variant?: "normal" | "pro" | "danger";
  onClick?: () => void;
  /** Mode ikon-saja: label disembunyikan, tooltip via title. */
  collapsed?: boolean;
}

const base =
  "flex items-center rounded-clay-md py-2 text-[14px] font-bold transition-all duration-75 select-none";

export const SidebarItem = ({
  icon: Icon,
  label,
  href,
  active = false,
  variant = "normal",
  onClick,
  collapsed = false,
}: SidebarItemProps) => {
  const itemBase = `${base} ${collapsed ? "justify-center px-1" : "gap-3 px-4"}`;
  const labelNode = !collapsed && label;
  if (variant === "pro") {
    return (
      <Link
        href={href}
        onClick={onClick}
        title={collapsed ? label : undefined}
        className={`${itemBase} bg-clay-secondary text-white shadow-[0_6px_0_#B45309] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_4px_0_#B45309]`}
      >
        <Icon size={16} />
        {labelNode}
      </Link>
    );
  }

  if (variant === "danger") {
    return (
      <Link
        href={href}
        onClick={onClick}
        title={collapsed ? label : undefined}
        className={`${itemBase} text-clay-dark hover:bg-clay-beige hover:text-red-500 hover:shadow-[0_4px_0_#D1C4B4]`}
      >
        <Icon size={16} />
        {labelNode}
      </Link>
    );
  }

  if (active) {
    return (
      <Link
        href={href}
        onClick={onClick}
        title={collapsed ? label : undefined}
        className={`${itemBase} border-3 border-clay-borderLight bg-clay-primary text-white shadow-[0_6px_0_#5B21B6] active:translate-y-0.5 active:shadow-[0_4px_0_#5B21B6]`}
      >
        <Icon size={16} />
        {labelNode}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`${itemBase} text-clay-dark hover:bg-clay-beige hover:shadow-[0_4px_0_#D1C4B4]`}
    >
      <Icon size={16} />
      {labelNode}
    </Link>
  );
};
