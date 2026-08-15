import type { Metadata } from "next";

const SITE_URL = "https://www.eureka-ai.web.id";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Daftar Gratis — Eureka.AI | AI Tutor untuk Belajar Lebih Cepat",
  description:
    "Daftar gratis di Eureka.AI — AI Tutor Socratic yang membimbingmu memahami materi, bukan sekadar memberi jawaban. Tanpa kartu kredit.",
  alternates: { canonical: "/register" },
  robots: { index: false, follow: false },
};

export default function RegisterLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
