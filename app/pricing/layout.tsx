import type { Metadata } from "next";
import { pageMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    path: "/pricing",
    title: {
      id: "Harga Eureka.AI — AI Tutor Socratic Gratis & Pro (Rp 15.000/bulan)",
      en: "Eureka.AI Pricing — Free & Pro Socratic AI Tutor (Rp 15.000/month)",
    },
    description: {
      id: "Eureka Pro Rp 15.000 untuk chat AI, catatan, bab, mindmap, kuis, flashcard, dan panggilan suara. Bayar sekali, aktif 30 hari.",
      en: "Eureka Pro at Rp 15.000 for AI chat, notes, chapters, mindmaps, quizzes, flashcards, and voice calls. Pay once, active 30 days.",
    },
    ogTitle: {
      id: "Harga Eureka.AI — Gratis & Pro",
      en: "Eureka.AI Pricing — Free & Pro",
    },
  });
}

export default function PricingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
import "../dashboard/more-pages.css";
