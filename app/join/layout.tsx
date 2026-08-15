import type { Metadata } from "next";

const SITE_URL = "https://www.eureka-ai.web.id";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title:
    "Program Beta Eureka.AI — Coba Fitur Baru: Rekam Suara & Panggilan AI",
  description:
    "Gabung beta tester Eureka.AI dan coba fitur eksperimental lebih awal: rekam suara di composer dan panggilan suara AI realtime dengan visualizer. Gratis, langsung aktif.",
  alternates: { canonical: "/join" },
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "Eureka.AI",
    title: "Program Beta Eureka.AI — Coba Fitur Baru",
    description:
      "Fitur eksperimental Eureka.AI: rekam suara di composer & panggilan suara AI. Gabung sekarang, gratis.",
    url: `${SITE_URL}/join`,
    images: [
      {
        url: "/banner.png",
        width: 1200,
        height: 800,
        alt: "Program Beta Eureka.AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Program Beta Eureka.AI",
    description:
      "Coba fitur baru Eureka.AI: rekam suara & panggilan suara AI. Gratis, langsung aktif.",
    images: ["/banner.png"],
  },
};

export default function JoinLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
