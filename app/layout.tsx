import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Nunito } from "next/font/google";
import "./globals.css";

// Font self-hosted (next/font) — tanpa request render-blocking ke
// fonts.googleapis.com (PageSpeed mobile: hemat ±2 detik LCP).
const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
});
import { OnboardingProvider } from "@/context/OnboardingContext";
import { JobWatcherProvider } from "@/context/JobWatcherContext";
import { ThemeProvider } from "@/context/ThemeContext";
import LevelUpOverlay from "@/components/dashboard/LevelUpOverlay";
import PremiumSuccessPopup from "@/components/PremiumSuccessPopup";

const SITE_URL = "https://www.eureka-ai.web.id";

const BRAND_TITLE = "Eureka.AI — AI Tutor Socratic untuk Pelajar Indonesia";
const BRAND_DESC =
  "Eureka.AI adalah AI Tutor Socratic untuk pelajar Indonesia: ubah video, artikel & PDF jadi catatan otomatis, tanya apa saja per bab, kerjakan kuis & kartu hafalan, dan belajar bersama teman secara real-time. Bukan sekadar memberi jawaban, tapi membimbingmu menemukan momen Eureka!";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: BRAND_TITLE,
  description: BRAND_DESC,
  alternates: { canonical: "/" },
  keywords: [
    "AI tutor",
    "tutor AI Indonesia",
    "AI belajar",
    "catatan otomatis AI",
    "AI Socratic",
    "belajar online",
    "kuis AI",
    "kartu hafalan",
    "Eureka AI",
    "aplikasi belajar",
    "belajar dengan AI gratis",
  ],
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
  // Verifikasi Google Search Console (property URL prefix).
  verification: {
    google: "r55Jc2M7F8_mVv-0bdIHcatfKxGYSwyR5abbNv3ZwZw",
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "Eureka.AI",
    title: BRAND_TITLE,
    description: BRAND_DESC,
    url: SITE_URL,
    images: [
      {
        url: "/banner.png",
        width: 1200,
        height: 800,
        alt: "Eureka.AI — AI Tutor Socratic untuk Pelajar Indonesia",
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
    <html lang="id" suppressHydrationWarning>
      <body className={`${nunito.variable} antialiased`}>
        {/* Anti-FOUC: terapkan class .dark sebelum paint berdasarkan
            preferensi tersimpan / sistem (lihat context/ThemeContext.tsx).
            next/script beforeInteractive → dirender di <head> sebelum
            hydration (tanpa warning script-in-component React). */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("eureka_theme");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark");}catch(e){}})();`,
          }}
        />
        <ThemeProvider>
          <JobWatcherProvider>
            <OnboardingProvider>
              {children}
              <LevelUpOverlay />
              <PremiumSuccessPopup />
            </OnboardingProvider>
          </JobWatcherProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
