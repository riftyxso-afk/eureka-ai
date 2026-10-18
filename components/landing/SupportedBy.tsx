"use client";

import Image from "next/image";
import { useI18n } from "@/context/LocaleContext";

const MODELS = [
  { name: "OpenAI", logo: "/images/ai-models/openai-color.svg" },
  { name: "Claude", logo: "/images/ai-models/claude-color.svg" },
  { name: "DeepSeek", logo: "/images/ai-models/deepseek-color.svg" },
  { name: "NVIDIA", logo: "/images/ai-models/nvidia-color.svg" },
  { name: "Gemini", logo: "/images/ai-models/gemini-color.svg" },
  { name: "Qwen", logo: "/images/ai-models/qwen-color.svg" },
];

export function SupportedBy() {
  const { dict } = useI18n();

  return (
    <section
      aria-label="Didukung oleh AI Terdepan"
      className="w-full py-12 sm:py-16 px-4 sm:px-6 lg:px-8 border-t border-gray-100 dark:border-white/5 bg-gray-50/40 dark:bg-white/[0.01]"
    >
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-6 text-center">
        <p className="text-xs sm:text-sm font-semibold tracking-wider text-gray-500 dark:text-gray-400 uppercase">
          {dict.aiModels.label}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          {MODELS.map((m) => (
            <div
              key={m.name}
              className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white dark:bg-[#161528] border border-gray-200/70 dark:border-white/10 shadow-sm opacity-85 hover:opacity-100 transition-opacity"
            >
              <Image
                src={m.logo}
                alt={m.name}
                width={22}
                height={22}
                className="w-5 h-5 object-contain"
              />
              <span className="font-semibold text-xs sm:text-sm text-gray-700 dark:text-gray-200">
                {m.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
