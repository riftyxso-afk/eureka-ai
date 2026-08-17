import type { Metadata } from "next";
import { pageMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    path: "/login",
    title: {
      id: "Masuk — Eureka.AI | AI Tutor Socratic untuk Pelajar Indonesia",
      en: "Log in — Eureka.AI | Socratic AI Tutor for Students",
    },
    description: {
      id: "Masuk ke akun Eureka.AI dan lanjutkan belajarmu bersama AI Tutor Socratic: catatan otomatis, kuis, kartu hafalan, dan kolaborasi real-time.",
      en: "Log in to your Eureka.AI account and continue learning with a Socratic AI Tutor: auto-generated notes, quizzes, flashcards, and real-time collaboration.",
    },
    robotsNoindex: true,
  });
}

export default function LoginLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
