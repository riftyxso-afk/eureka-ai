"use client";

import Link from "next/link";
import {
  ArrowUp,
  CheckCircle2,
  FileText,
  GraduationCap,
  Home,
  MessageCircleQuestion,
  Rocket,
  Sparkles,
  Zap,
} from "lucide-react";
import CardClay from "@/components/ui/CardClay";
import ButtonClay from "@/components/ui/ButtonClay";
import { useI18n } from "@/context/LocaleContext";

/** Link Product Hunt Eureka.AI (dengan UTM kampanye). */
const PRODUCT_HUNT_URL =
  "https://www.producthunt.com/products/eureka-ai-socratic-ai-study-tutor?utm_source=twitter&utm_medium=social";

/**
 * Halaman /upvote — kampanye Product Hunt.
 * Menampilkan Eureka.AI (tutor) + tutorial cara upvote, dengan tombol CTA
 * besar yang mengarahkan ke halaman Product Hunt. Publik (bisa di-share).
 */
export default function UpvotePage() {
  const { dict } = useI18n();
  const l = dict.upvote;

  const PERKS = [
    { icon: FileText, title: l.perks[0].title, desc: l.perks[0].desc },
    { icon: MessageCircleQuestion, title: l.perks[1].title, desc: l.perks[1].desc },
    { icon: Zap, title: l.perks[2].title, desc: l.perks[2].desc },
  ];

  return (
    <main className="min-h-screen bg-clay-beige px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-clay-full bg-clay-primary/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-clay-primary">
            <Rocket size={12} /> {l.chip}
          </span>
          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">{l.title}</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm font-semibold text-clay-muted sm:text-base">
            {l.subtitle}
          </p>
        </div>

        {/* CTA utama → Product Hunt */}
        <div className="mb-2 text-center">
          <a
            href={PRODUCT_HUNT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-clay-primary inline-flex items-center gap-2 px-8 !py-4 text-base sm:text-lg"
          >
            <ArrowUp size={20} strokeWidth={3} />
            {l.cta}
          </a>
          <p className="mt-3 text-xs font-semibold text-clay-muted">{l.ctaNote}</p>
        </div>

        {/* Kenapa Eureka.AI (tutor) */}
        <div className="mt-12">
          <h2 className="text-center text-xl font-extrabold sm:text-2xl">
            {l.tutorTitle}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm font-semibold text-clay-muted">
            {l.tutorSubtitle}
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {PERKS.map((p) => (
              <CardClay key={p.title} className="p-5 text-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-clay-full bg-clay-primary/10 text-clay-primary">
                  <p.icon size={22} />
                </span>
                <h3 className="mt-3 text-sm font-extrabold">{p.title}</h3>
                <p className="mt-1.5 text-xs font-semibold text-clay-muted">
                  {p.desc}
                </p>
              </CardClay>
            ))}
          </div>
        </div>

        {/* Cara upvote (tutorial) */}
        <div className="mt-12">
          <h2 className="flex items-center justify-center gap-2 text-center text-xl font-extrabold sm:text-2xl">
            <GraduationCap size={22} className="text-clay-primary" />
            {l.howTitle}
          </h2>
          <div className="mt-6 space-y-3">
            {l.steps.map((s, i) => (
              <CardClay key={s.title} className="flex items-start gap-3 p-4">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-clay-full bg-clay-primary text-xs font-extrabold text-white shadow-[0_2px_0_#5B21B6]">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-sm font-extrabold">{s.title}</h3>
                  <p className="mt-0.5 text-xs font-semibold text-clay-muted">
                    {s.desc}
                  </p>
                </div>
              </CardClay>
            ))}
          </div>
        </div>

        {/* Aksi sekunder */}
        <div className="mt-12 flex flex-col justify-center gap-2 sm:flex-row">
          <Link href="/home">
            <ButtonClay className="w-full sm:w-auto">
              <span className="inline-flex items-center gap-2">
                <Sparkles size={18} /> {l.askCta}
              </span>
            </ButtonClay>
          </Link>
          <Link href="/">
            <ButtonClay variant="secondary" className="w-full sm:w-auto">
              <span className="inline-flex items-center gap-2">
                <Home size={18} /> {l.backHome}
              </span>
            </ButtonClay>
          </Link>
        </div>

        <p className="mt-8 text-center text-xs font-semibold text-clay-muted">
          <CheckCircle2 size={12} className="mr-1 inline text-clay-primary" />
          Eureka.AI
        </p>
      </div>
    </main>
  );
}
