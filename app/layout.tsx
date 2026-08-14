import type { Metadata, Viewport } from "next";
import "./globals.css";
import { OnboardingProvider } from "@/context/OnboardingContext";
import { JobWatcherProvider } from "@/context/JobWatcherContext";
import LevelUpOverlay from "@/components/dashboard/LevelUpOverlay";
import KemerdekaanPopup from "@/components/KemerdekaanPopup";
import PremiumSuccessPopup from "@/components/PremiumSuccessPopup";

const SITE_URL = "https://www.eureka-ai.web.id";

const BRAND_TITLE = "Eureka.AI — Bukan sekadar jawaban, tapi momen Eureka!";
const BRAND_DESC =
  "AI Tutor Socratic untuk semua pelajar Indonesia. Bukan sekadar memberi jawaban, tapi membimbingmu menemukan momen Eureka!";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: BRAND_TITLE,
  description: BRAND_DESC,
  // PWA: manifest + meta Apple agar bisa "Add to Home Screen" (wajib untuk
  // notifikasi web di iOS) — ikon pakai /logo.png yang sudah tersedia.
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Eureka.AI",
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
        alt: "Eureka.AI — Bukan sekadar jawaban, tapi momen Eureka!",
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

export const viewport: Viewport = {
  themeColor: "#7C3AED",
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
            <PremiumSuccessPopup />
          </OnboardingProvider>
        </JobWatcherProvider>
      </body>
    </html>
  );
}
