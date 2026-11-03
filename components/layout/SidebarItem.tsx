"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import SidebarIcon from "./SidebarIcon";

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  href: string;
  active?: boolean;
  variant?: "normal" | "pro" | "danger";
  onClick?: () => void;
  collapsed?: boolean;
  art?: string;
}

export const SidebarItem = ({ icon: Icon, label, href, active = false, variant = "normal", onClick, collapsed = false, art }: SidebarItemProps) => (
  <Link
    href={href}
    onClick={onClick}
    title={collapsed ? label : undefined}
    aria-label={collapsed ? label : undefined}
    aria-current={active ? "page" : undefined}
    className={`eureka-sidebar-item ${active ? "is-active" : ""} ${variant === "pro" ? "is-pro" : ""} ${variant === "danger" ? "is-danger" : ""} ${collapsed ? "is-collapsed" : ""}`}
  >
    {art ? <SidebarIcon name={art} /> : <Icon size={19} strokeWidth={2} aria-hidden="true" />}
    {!collapsed && <span>{label}</span>}
  </Link>
);
