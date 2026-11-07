import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Sidebar } from "@/components/layout/Sidebar";
import StudyBuddyProvider from "@/components/study-buddy/StudyBuddyProvider";
import AuthGuard from "@/components/auth/AuthGuard";
import PageTutorial from "@/components/tutorial/PageTutorial";
import "./dashboard-pages.css";
import "./more-pages.css";

// Dashboard = area login → jangan diindeks Google (buang crawl budget).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="dashboard-shell flex min-h-screen flex-col bg-clay-beige lg:flex-row lg:gap-4 lg:p-4">
        <Sidebar />
        <main className="dashboard-main min-w-0 flex-1 px-4 lg:min-h-screen lg:px-0"><div className="dashboard-guide-row"><PageTutorial /></div>{children}</main>
        <StudyBuddyProvider />
      </div>
    </AuthGuard>
  );
}
