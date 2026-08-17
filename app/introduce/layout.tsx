import type { Metadata } from "next";
import { pageMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    path: "/introduce",
    title: {
      id: "Video Pengenalan Eureka.AI — AI Tutor Socratic untuk Pelajar",
      en: "Eureka.AI Intro Video — Socratic AI Tutor for Students",
    },
    description: {
      id: "Tonton video pengenalan Eureka.AI dalam Bahasa Indonesia atau English: ubah video, artikel & PDF jadi catatan otomatis, tanya apa saja per bab, dan kerjakan kuis & kartu hafalan.",
      en: "Watch the Eureka.AI intro video in Indonesian or English: turn videos, articles & PDFs into auto-generated notes, ask anything per chapter, and take quizzes & flashcards.",
    },
    ogTitle: {
      id: "Video Pengenalan Eureka.AI",
      en: "Eureka.AI Intro Video",
    },
  });
}

export default function IntroduceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}