import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import StudyBuddyProvider from "@/components/study-buddy/StudyBuddyProvider";
import AuthGuard from "@/components/auth/AuthGuard";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen gap-4 bg-clay-beige p-4">
        <Sidebar />
        <main className="min-h-screen flex-1 pt-16 lg:pt-0">{children}</main>
        <StudyBuddyProvider />
      </div>
    </AuthGuard>
  );
}
