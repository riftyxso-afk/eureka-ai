import AuthGuard from "@/components/auth/AuthGuard";
import type { Metadata } from "next";
import type { ReactNode } from "react";

// Area login → jangan diindeks Google.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function HomeLayout({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
