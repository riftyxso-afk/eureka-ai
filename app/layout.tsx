import type { Metadata } from "next";
import "./globals.css";
import { OnboardingProvider } from "@/context/OnboardingContext";
import { JobWatcherProvider } from "@/context/JobWatcherContext";
import LevelUpOverlay from "@/components/dashboard/LevelUpOverlay";
import KemerdekaanPopup from "@/components/KemerdekaanPopup";

const SITE_URL = "https://www.eureka-ai.web.id";

const BRAND_TITLE = "Eureka.AI — Bukan ngasih jawaban, tapi ngasih Eureka!";
const BRAND_DESC =
  "AI Tutor Socratic untuk semua pelajar Indonesia. Bukan ngasih jawaban, tapi ngasih Eureka!";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: BRAND_TITLE,
  description: BRAND_DESC,
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "Eureka.AI",
    title: BRAND_TITLE,
    description: BRAND_DESC,
    images: [
      {
        url: "/banner.png",
        width: 1200,
        height: 800,
        alt: "Eureka.AI — Bukan ngasih jawaban, tapi ngasih Eureka!",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND_TITLE,
    description: BRAND_DESC,
    images: ["/banner.png"],
  },
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
            <KemerdekaanPopup />
          </OnboardingProvider>
        </JobWatcherProvider>
      </body>
    </html>
  );
}
