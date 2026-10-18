"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/context/LocaleContext";

interface FinalCtaProps {
  loggedIn: boolean;
  ctaHref: string;
}

export function FinalCta({ loggedIn, ctaHref }: FinalCtaProps) {
  const { dict } = useI18n();

  return (
    <section
      aria-label="Ajakan Bertindak"
      className="w-full py-12 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto"
    >
      <div className="rounded-3xl bg-gradient-to-br from-[#FAF5FF] to-[#EDE9FE] dark:from-[#1A142E] dark:to-[#241740] border border-violet-200/90 dark:border-violet-800/50 p-8 sm:p-16 text-center flex flex-col items-center gap-5 shadow-sm">
        <h2 className="font-extrabold text-3xl sm:text-5xl text-[#1A1A2E] dark:text-white tracking-tight max-w-2xl">
          {dict.finalCta.title}
        </h2>
        <p className="text-sm sm:text-base lg:text-lg text-gray-600 dark:text-gray-300 max-w-xl">
          {dict.finalCta.subtitle}
        </p>

        <div className="mt-4 flex flex-col items-center gap-3">
          <Link
            href={ctaHref}
            className="anim-press inline-flex items-center justify-center gap-2.5 h-[52px] px-8 sm:px-10 rounded-2xl bg-[#7C3AED] hover:bg-[#6D28D9] active:bg-[#5B21B6] text-white font-semibold text-base sm:text-lg shadow-[0_8px_24px_rgba(124,58,237,0.35)] hover:shadow-[0_12px_28px_rgba(124,58,237,0.45)] focus:outline-none focus:ring-4 focus:ring-violet-400/40"
          >
            <span>{loggedIn ? dict.nav.bukaDashboard : dict.finalCta.cta}</span>
            <ArrowRight size={20} />
          </Link>
          <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {dict.finalCta.note}
          </span>
        </div>
      </div>
    </section>
  );
}
