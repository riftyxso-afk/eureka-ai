import type { Metadata } from "next";
import type { ReactNode } from "react";

// Halaman kuis publik via link share — konten dinamis per token, jangan diindeks.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function QuizLayout({ children }: { children: ReactNode }) {
  return children;
}
