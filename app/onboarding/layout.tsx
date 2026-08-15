import type { Metadata } from "next";
import type { ReactNode } from "react";

// Halaman onboarding — hanya untuk user baru yang login, jangan diindeks.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return children;
}
