import type { ReactNode } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import InstallEureka from "@/components/dashboard/InstallEureka";
import V2Progress from "@/components/dashboard/V2Progress";
import "./v2.css";
import "./sidebar.css";
import "@/components/dashboard/study-room.css";
import "./mobile-comfort.css";
import "./account-pages.css";
export const metadata = { title: "Dashboard V2 · Eureka", robots: { index: false, follow: false } };
export default function Layout({ children }: { children: ReactNode }) {
  return <AuthGuard><V2Progress>{children}</V2Progress><InstallEureka /></AuthGuard>;
}
