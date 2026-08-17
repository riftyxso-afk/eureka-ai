import type { Metadata } from "next";
import { pageMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    path: "/register",
    title: {
      id: "Daftar Gratis — Eureka.AI | AI Tutor untuk Belajar Lebih Cepat",
      en: "Sign Up Free — Eureka.AI | AI Tutor to Learn Faster",
    },
    description: {
      id: "Daftar gratis di Eureka.AI — AI Tutor Socratic yang membimbingmu memahami materi, bukan sekadar memberi jawaban. Tanpa kartu kredit.",
      en: "Sign up free at Eureka.AI — a Socratic AI Tutor that guides you to understand material, not just give answers. No credit card required.",
    },
    robotsNoindex: true,
  });
}

export default function RegisterLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
