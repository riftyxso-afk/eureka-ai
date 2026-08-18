import type { Metadata } from "next";
import { pageMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    path: "/upvote",
    title: {
      id: "Upvote Eureka.AI di Product Hunt — AI Tutor Socratic untuk Pelajar",
      en: "Upvote Eureka.AI on Product Hunt — Socratic AI Tutor for Students",
    },
    description: {
      id: "Bantu Eureka.AI menang di Product Hunt: tutor AI Socratic yang mengubah video, artikel & PDF jadi catatan otomatis, kuis, kartu hafalan, dan tanya jawab per bab.",
      en: "Help Eureka.AI win on Product Hunt: a Socratic AI tutor that turns videos, articles & PDFs into auto-generated notes, quizzes, flashcards, and per-chapter Q&A.",
    },
    ogTitle: {
      id: "Upvote Eureka.AI di Product Hunt",
      en: "Upvote Eureka.AI on Product Hunt",
    },
  });
}

export default function UpvoteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
