import type { Metadata } from "next";
import { pageMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    path: "/pricing",
    title: {
      id: "Harga Eureka.AI — AI Tutor Socratic Gratis & Pro (Rp 59.000/bulan)",
      en: "Eureka.AI Pricing — Free & Pro Socratic AI Tutor (Rp 59.000/month)",
    },
    description: {
      id: "Lihat harga Eureka.AI: paket Gratis selamanya (Rp 0) atau Pro Rp 59.000 untuk chat AI tanpa batas, catatan otomatis tanpa batas, kuis & kartu hafalan, dan kolaborasi real-time. Bayar sekali, aktif 30 hari.",
      en: "See Eureka.AI pricing: Free forever (Rp 0) or Pro Rp 59.000 for unlimited AI chat, unlimited auto-generated notes, quizzes & flashcards, and real-time collaboration. Pay once, active 30 days.",
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
