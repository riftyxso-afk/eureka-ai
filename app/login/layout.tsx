import type { Metadata } from "next";

const SITE_URL = "https://www.eureka-ai.web.id";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Masuk — Eureka.AI | AI Tutor Socratic untuk Pelajar Indonesia",
  description:
    "Masuk ke akun Eureka.AI dan lanjutkan belajarmu bersama AI Tutor Socratic: catatan otomatis, kuis, kartu hafalan, dan kolaborasi real-time.",
  alternates: { canonical: "/login" },
  robots: { index: true, follow: true },
};

export default function LoginLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
