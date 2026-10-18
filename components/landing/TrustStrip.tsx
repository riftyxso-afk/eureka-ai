"use client";

import { useI18n } from "@/context/LocaleContext";

export function TrustStrip() {
  const { dict } = useI18n();

  return (
    <section
      aria-label="Institusi Pelajar"
      className="w-full py-8 sm:py-12 border-y border-gray-100 dark:border-white/5 bg-gray-50/60 dark:bg-white/[0.02] overflow-hidden"
    >
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-6 text-center px-4">
        <p className="text-xs sm:text-sm font-semibold tracking-wider text-gray-500 dark:text-gray-400 uppercase">
          {dict.trust.label}
        </p>

        {/* Marquee Track with gradient fade masks on the edges */}
        <div className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div className="anim-marquee flex items-center gap-4 py-2">
            {[...dict.trust.items, ...dict.trust.items].map((name, i) => (
              <div
                key={`${name}-${i}`}
                className="anim-hover-lift px-5 py-2.5 rounded-2xl bg-white dark:bg-[#161528] border border-gray-200/80 dark:border-white/10 shadow-xs text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-200 hover:border-violet-300 dark:hover:border-violet-700 hover:text-[#7C3AED] dark:hover:text-violet-400 whitespace-nowrap cursor-default"
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
