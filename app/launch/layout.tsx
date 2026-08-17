import type { Metadata } from "next";

const SITE_URL = "https://www.eureka-ai.web.id";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title:
    "Launch Eureka.AI — Klaim Trial Pro 7 Hari & Akses Beta Tester",
  description:
    "Hadiah peluncuran Eureka.AI: trial Pro 7 hari (chat AI, catatan otomatis, kuis & flashcards tanpa batas) + akses beta tester (rekam suara & panggilan AI realtime). Gratis, aktif otomatis saat kamu masuk.",
  alternates: { canonical: "/launch" },
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "Eureka.AI",
    title: "Launch Eureka.AI — Klaim Trial Pro & Akses Beta",
    description:
      "Trial Pro 7 hari + akses beta tester Eureka.AI. Gratis, aktif otomatis saat kamu masuk.",
    url: `${SITE_URL}/launch`,
    images: [
      {
        url: "/banner.png",
        width: 1200,
        height: 800,
        alt: "Launch Eureka.AI — Klaim Trial Pro & Akses Beta",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Launch Eureka.AI — Klaim Trial Pro & Akses Beta",
    description:
      "Trial Pro 7 hari + akses beta tester Eureka.AI. Gratis, aktif otomatis.",
    images: ["/banner.png"],
  },
};

export default function LaunchLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
