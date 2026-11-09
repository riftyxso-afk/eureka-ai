import type { ReactNode } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import "./v2.css";
import "./sidebar.css";
import "@/components/dashboard/study-room.css";
export const metadata = { title: "Dashboard V2 · Eureka", robots: { index: false, follow: false } };
export default function Layout({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
