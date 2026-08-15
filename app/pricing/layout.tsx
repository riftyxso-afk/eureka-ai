import type { Metadata } from "next";

const SITE_URL = "https://www.eureka-ai.web.id";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title:
    "Harga Eureka.AI — AI Tutor Socratic Gratis & Pro (Rp 59.000/bulan)",
  description:
    "Lihat harga Eureka.AI: paket Gratis selamanya (Rp 0) atau Pro Rp 59.000 untuk chat AI tanpa batas, catatan otomatis tanpa batas, kuis & kartu hafalan, dan kolaborasi real-time. Bayar sekali, aktif 30 hari.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "Eureka.AI",
    title: "Harga Eureka.AI — Gratis & Pro",
    description:
      "AI Tutor Socratic untuk pelajar Indonesia. Mulai gratis selamanya, upgrade Pro Rp 59.000 untuk fitur tanpa batas.",
    url: `${SITE_URL}/pricing`,
    images: [
      {
        url: "/banner.png",
        width: 1200,
        height: 800,
        alt: "Harga Eureka.AI — Gratis & Pro",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Harga Eureka.AI — Gratis & Pro",
    description: "AI Tutor Socratic untuk pelajar Indonesia. Mulai gratis, upgrade Pro Rp 59.000.",
    images: ["/banner.png"],
  },
};

export default function PricingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
