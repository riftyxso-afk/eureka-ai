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
      id: "Akun baru mendapat 28 hari Eureka Pro. Belajar dengan model AI canggih, catatan, kuis interaktif, konektor, dan tutor suara serta video.",
      en: "New accounts get 28 days of Eureka Pro. Learn with advanced AI models, notes, interactive quizzes, connectors, and voice and video tutoring.",
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
