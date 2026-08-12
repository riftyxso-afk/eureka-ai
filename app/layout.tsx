import type { Metadata } from "next";
import "./globals.css";
import { OnboardingProvider } from "@/context/OnboardingContext";
import { JobWatcherProvider } from "@/context/JobWatcherContext";
import LevelUpOverlay from "@/components/dashboard/LevelUpOverlay";

export const metadata: Metadata = {
  title: "Eureka.AI — Bukan ngasih jawaban, tapi ngasih Eureka!",
  description:
    "AI Tutor Socratic untuk siswa SMA Indonesia. Bukan ngasih jawaban, tapi ngasih Eureka!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased">
        <JobWatcherProvider>
          <OnboardingProvider>
            {children}
            <LevelUpOverlay />
          </OnboardingProvider>
        </JobWatcherProvider>
      </body>
    </html>
  );
}
