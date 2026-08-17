import type { Metadata } from "next";
import { pageMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    path: "/join",
    title: {
      id: "Program Beta Eureka.AI — Coba Fitur Baru: Rekam Suara & Panggilan AI",
      en: "Eureka.AI Beta Program — Try New Features: Voice Recording & AI Calls",
    },
    description: {
      id: "Gabung beta tester Eureka.AI dan coba fitur eksperimental lebih awal: rekam suara di composer dan panggilan suara AI realtime dengan visualizer. Gratis, langsung aktif.",
      en: "Join Eureka.AI's beta tester program and try experimental features early: voice recording in the composer and realtime AI voice calls with a visualizer. Free, activates instantly.",
    },
    ogTitle: {
      id: "Program Beta Eureka.AI — Coba Fitur Baru",
      en: "Eureka.AI Beta Program — Try New Features",
    },
  });
}

export default function JoinLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
