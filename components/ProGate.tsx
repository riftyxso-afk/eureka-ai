"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Crown, LockKeyhole } from "lucide-react";
import { usePremium } from "@/lib/usePremium";
import { useI18n } from "@/context/LocaleContext";
import "./pro-access.css";
import LoadingStatus from "@/components/ui/LoadingStatus";

export function ProLockedCard() {
  const { locale } = useI18n();
  const english = locale === "en";
  return <section className="eureka-pro-lock" aria-labelledby="eureka-pro-lock-title">
    <span className="eureka-pro-emblem"><LockKeyhole size={23} aria-hidden="true" /></span>
    <span className="eureka-pro-kicker"><Crown size={14} aria-hidden="true" /> Eureka Pro</span>
    <h2 id="eureka-pro-lock-title">{english ? "Unlock your study tools" : "Buka fitur belajarmu"}</h2>
    <p>{english ? "Create notes, chat with Momo, and practise with quizzes and flashcards." : "Buat catatan, ngobrol dengan Momo, dan latihan lewat kuis serta flashcard."}</p>
    <Link className="eureka-pro-cta" href="/dashboard-v2/pricing">
      {english ? "See the Pro plan" : "Lihat paket Pro"} <ArrowRight size={16} aria-hidden="true" />
    </Link>
  </section>;
}

export default function ProGate({ children }: { children: ReactNode }) {
  const { loading, isPremium, error, refresh } = usePremium();
  if (loading) return <div className="eureka-pro-pending"><LoadingStatus stage="synchronizing" detail="Memeriksa paketmu" /></div>;
  if (error) return <div className="eureka-pro-page"><p role="alert">{error}</p><button type="button" className="eureka-pro-cta" onClick={() => void refresh()}>Coba lagi</button></div>;
  if (!isPremium) return <div className="eureka-pro-page"><ProLockedCard /><Link href="/dashboard-v2">Kembali ke dashboard</Link></div>;
  return children;
}
