import type { Metadata } from "next";
import type { ReactNode } from "react";

// Snapshot publik (view-only) — konten dinamis per token, jangan diindeks.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ShareLayout({ children }: { children: ReactNode }) {
  return children;
}
