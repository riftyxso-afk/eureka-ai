import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import StudyBuddyProvider from "@/components/study-buddy/StudyBuddyProvider";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen gap-4 bg-clay-beige p-4">
      <Sidebar />
      <main className="min-h-screen flex-1 pt-16 lg:pt-0">{children}</main>
      <StudyBuddyProvider />
    </div>
  );
}
