import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { headers } from "next/headers";
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
import { LocaleProvider } from "@/context/LocaleContext";
import LevelUpOverlay from "@/components/dashboard/LevelUpOverlay";
import PremiumSuccessPopup from "@/components/PremiumSuccessPopup";
import SoundInitializer from "@/components/SoundInitializer";
import {
  alternatesFor,
  getDictionary,
  isLocale,
  ogLocale,
  type Locale,
} from "@/lib/i18n";

const SITE_URL = "https://www.eureka-ai.web.id";

export const viewport: Viewport = {
  themeColor: "#7C3AED",
};

/** Baca locale aktif dari header x-locale yang diset middleware. */
async function getRequestLocale(): Promise<Locale> {
  try {
    const h = await headers();
    const raw = h.get("x-locale");
    return raw && isLocale(raw) ? raw : "id";
  } catch {
    return "id";
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const dict = getDictionary(locale);
  const title =
    locale === "en"
      ? "Eureka.AI — Socratic AI Tutor for Students"
      : "Eureka.AI — AI Tutor Socratic untuk Pelajar Indonesia";
  const description =
    locale === "en"
      ? "Eureka.AI is a Socratic AI Tutor for students: turn videos, articles & PDFs into auto-generated notes, ask anything per chapter, take quizzes & flashcards, and study together in real time. Not just answers — it guides you to your Eureka moment!"
      : "Eureka.AI adalah AI Tutor Socratic untuk pelajar Indonesia: ubah video, artikel & PDF jadi catatan otomatis, tanya apa saja per bab, kerjakan kuis & kartu hafalan, dan belajar bersama teman secara real-time. Bukan sekadar memberi jawaban, tapi membimbingmu menemukan momen Eureka!";

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: alternatesFor(locale, "/"),
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
      locale: ogLocale(locale),
      siteName: "Eureka.AI",
      title,
      description,
      url: SITE_URL,
      images: [
        {
          url: "/banner.png",
          width: 1200,
          height: 800,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/banner.png"],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
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
        <LocaleProvider initialLocale={locale}>
          <ThemeProvider>
            <JobWatcherProvider>
              <OnboardingProvider>
                {children}
                <LevelUpOverlay />
                <PremiumSuccessPopup />
                <SoundInitializer />
              </OnboardingProvider>
            </JobWatcherProvider>
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
