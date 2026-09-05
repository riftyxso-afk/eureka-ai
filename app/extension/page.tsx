"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Download,
  Globe,
  Highlighter,
  MessageCircleQuestion,
  NotebookPen,
  Flame,
  PanelRight,
} from "lucide-react";
import CardClay from "@/components/ui/CardClay";
import ButtonClay from "@/components/ui/ButtonClay";
import { useI18n } from "@/context/LocaleContext";

/**
 * Halaman /extension — download ekstensi browser Eureka.AI.
 * ZIP dibuat oleh `npm run build:extension` (public/eureka-extension.zip)
 * dengan config produksi, jadi user tidak perlu edit apa pun.
 * Publik (bisa di-share).
 */
export default function ExtensionPage() {
  const { dict } = useI18n();
  const l = dict.extension;

  const FEATURE_ICONS = [Highlighter, NotebookPen, PanelRight, Flame];

  return (
    <main className="min-h-screen bg-clay-beige px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-clay-full bg-clay-primary/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-clay-primary">
            <Globe size={12} /> {l.chip}
          </span>
          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">{l.title}</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm font-semibold text-clay-muted sm:text-base">
            {l.subtitle}
          </p>
        </div>

        <CardClay>
          {/* CTA download */}
          <div className="text-center">
            <a href="/eureka-extension.zip" download="eureka-extension.zip">
              <ButtonClay className="px-8 !py-4 text-base sm:text-lg">
                <Download size={20} strokeWidth={3} /> {l.cta}
              </ButtonClay>
            </a>
            <p className="mt-2 text-xs font-bold text-clay-muted">{l.ctaNote}</p>
          </div>

          {/* Fitur */}
          <h2 className="mt-8 text-lg font-extrabold">{l.featuresTitle}</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {l.features.map((f, i) => {
              const Icon = FEATURE_ICONS[i] ?? MessageCircleQuestion;
              return (
                <li key={f.title} className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-clay-primary/10">
                    <Icon size={17} className="text-clay-primary" />
                  </span>
                  <span>
                    <span className="block text-sm font-extrabold text-clay-dark">
                      {f.title}
                    </span>
                    <span className="block text-sm font-semibold text-clay-muted">
                      {f.desc}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>

          {/* Cara pasang */}
          <h2 className="mt-8 text-lg font-extrabold">{l.howTitle}</h2>
          <ol className="mt-3 flex flex-col gap-2.5">
            {l.steps.map((s, i) => (
              <li key={s.title} className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-clay-primary font-extrabold text-sm text-white">
                  {i + 1}
                </span>
                <span>
                  <span className="block text-sm font-extrabold text-clay-dark">
                    {s.title}
                  </span>
                  <span className="block text-sm font-semibold text-clay-muted">
                    {s.desc}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex items-start gap-2 rounded-clay-md bg-clay-beige/60 px-4 py-3 text-xs font-semibold text-clay-muted">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-clay-success" />
            <span>{l.ctaNote}</span>
          </div>

          <Link href="/dashboard" className="mt-4 block text-center">
            <ButtonClay variant="secondary">{l.backHome}</ButtonClay>
          </Link>
        </CardClay>
      </div>
    </main>
  );
}
