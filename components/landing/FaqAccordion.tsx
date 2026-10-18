"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/context/LocaleContext";

export function FaqAccordion() {
  const { dict } = useI18n();
  const [openIndices, setOpenIndices] = useState<number[]>([0]);

  const toggleIndex = (idx: number) => {
    setOpenIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  return (
    <section
      id="faq"
      aria-label="Pertanyaan Umum"
      className="w-full py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto flex flex-col items-center gap-10"
    >
      {/* Heading */}
      <div className="text-center max-w-xl flex flex-col items-center gap-2">
        <h2 className="font-extrabold text-3xl sm:text-4xl text-[#1A1A2E] dark:text-white tracking-tight">
          {dict.faq.title}
        </h2>
        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
          {dict.faq.subtitle}
        </p>
      </div>

      {/* Accordion List with Smooth CSS Grid Transition */}
      <div className="w-full flex flex-col gap-3">
        {dict.faq.items.map((item, idx) => {
          const isOpen = openIndices.includes(idx);
          return (
            <div
              key={idx}
              className={`rounded-2xl border transition-colors ${
                isOpen
                  ? "bg-white dark:bg-[#1A182F] border-violet-200/80 dark:border-violet-900/40 shadow-xs"
                  : "bg-gray-50/80 dark:bg-[#161528] border-gray-200/80 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20"
              } p-5 sm:p-6`}
            >
              <button
                type="button"
                onClick={() => toggleIndex(idx)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-4 font-semibold text-base sm:text-lg text-left text-[#1A1A2E] dark:text-white focus:outline-none focus:text-[#7C3AED]"
              >
                <span>{item.q}</span>
                <span
                  className={`w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 transition-transform duration-200 ${
                    isOpen
                      ? "rotate-180 bg-violet-50 dark:bg-violet-950 text-[#7C3AED] border-violet-300 dark:border-violet-800"
                      : "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500"
                  }`}
                >
                  <ChevronDown size={18} />
                </span>
              </button>

              {/* Grid-based zero-layout-thrash height expansion */}
              <div
                className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="pt-4 text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed border-t border-gray-100 dark:border-white/5 mt-4">
                    <p>{item.a}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
