import type { Metadata } from "next";
import { pageMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    path: "/launch",
    title: {
      id: "Launch Eureka.AI — Klaim Trial Pro 7 Hari & Akses Beta Tester",
      en: "Eureka.AI Launch — Claim 7-Day Pro Trial & Beta Tester Access",
    },
    description: {
      id: "Hadiah peluncuran Eureka.AI: trial Pro 7 hari (chat AI, catatan otomatis, kuis & flashcards tanpa batas) + akses beta tester (rekam suara & panggilan AI realtime). Gratis, aktif otomatis saat kamu masuk.",
      en: "Eureka.AI launch gift: 7-day Pro trial (unlimited AI chat, auto notes, quizzes & flashcards) + beta tester access (voice recording & realtime AI calls). Free, auto-activated on signup.",
    },
    ogTitle: {
      id: "Launch Eureka.AI — Klaim Trial Pro & Akses Beta",
      en: "Eureka.AI Launch — Claim Pro Trial & Beta Access",
    },
  });
}

export default function LaunchLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
