"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Layers,
  HelpCircle,
  MessageCircle,
  ArrowUp,
  Bot,
  User,
} from "lucide-react";
import { useI18n } from "@/context/LocaleContext";

interface FeaturesBentoProps {
  ctaHref: string;
}

interface DemoExchange {
  question: string;
  socraticAnswer: string;
}

const DEMO_EXCHANGES: Record<string, DemoExchange> = {
  langit: {
    question: "Kenapa langit warnanya biru?",
    socraticAnswer:
      "Bayangkan cahaya matahari memiliki semua warna pelangi. Dari merah hingga ungu, warna mana yang memiliki panjang gelombang paling pendek dan paling mudah dihamburkan oleh partikel gas di atmosfer?",
  },
  kalkulus: {
    question: "Apa bedanya turunan dan integral?",
    socraticAnswer:
      "Jika speedometer mobil menunjukkan turunan (kecepatan sesaat dari posisi tiap detik), lalu odometer yang mencatat total jarak tempuh yang sudah terkumpul adalah apa?",
  },
  ekonomi: {
    question: "Kenapa harga barang naik saat langka?",
    socraticAnswer:
      "Jika ada 100 orang yang lapar di pulau terpencil tapi hanya ada 5 buah kelapa yang tersisa, apa yang akan dilakukan orang-orang itu untuk memperebutkan kelapa tersebut?",
  },
};

export function FeaturesBento({ ctaHref }: FeaturesBentoProps) {
  const { dict } = useI18n();
  const [activeKey, setActiveKey] = useState<string>("langit");
  const [customInput, setCustomInput] = useState("");
  const [chatHistory, setChatHistory] = useState<DemoExchange>(DEMO_EXCHANGES.langit);

  const handleSelectPrompt = (key: string) => {
    setActiveKey(key);
    setChatHistory(DEMO_EXCHANGES[key]);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    setChatHistory({
      question: customInput,
      socraticAnswer: `Pertanyaan bagus! Sebelum kita jawab, coba perhatikan bagian mana dari konsep "${customInput}" yang paling membuatmu penasaran atau bingung?`,
    });
    setCustomInput("");
  };

  return (
    <section
      id="fitur"
      aria-label="Fitur Unggulan"
      className="w-full py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-gray-50/70 dark:bg-[#121124] transition-colors"
    >
      <div className="max-w-6xl mx-auto flex flex-col items-center gap-12 sm:gap-16">
        {/* Section Header */}
        <div className="text-center max-w-3xl flex flex-col items-center gap-3">
          <span className="text-xs sm:text-sm font-bold tracking-widest text-[#7C3AED] dark:text-violet-400 uppercase">
            {dict.featuresBento.eyebrow}
          </span>
          <h2 className="font-extrabold text-3xl sm:text-5xl text-[#1A1A2E] dark:text-white tracking-tight leading-tight">
            {dict.featuresBento.title}
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-xl">
            {dict.featuresBento.subtitle}
          </p>
        </div>

        {/* Bento Grid Layout */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Column (span 7) */}
          <div className="lg:col-span-7 flex flex-col gap-6 justify-between">
            {/* Top Highlight Card: Ringkasan Otomatis */}
            <div className="anim-hover-lift rounded-3xl bg-white dark:bg-[#161528] border border-gray-200/80 dark:border-white/10 p-7 sm:p-9 flex flex-col justify-between gap-6 shadow-sm">
              <div className="flex flex-col gap-3">
                <div className="w-11 h-11 rounded-2xl bg-violet-100 dark:bg-violet-950/80 text-[#7C3AED] dark:text-violet-400 flex items-center justify-center">
                  <Sparkles size={22} />
                </div>
                <h3 className="font-bold text-xl sm:text-2xl text-[#1A1A2E] dark:text-white tracking-tight">
                  {dict.featuresBento.summaryTitle}
                </h3>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed max-w-xl">
                  {dict.featuresBento.summaryDesc}
                </p>
              </div>

              {/* Visual simulated progress bar */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400">
                  <span>Mengekstrak konsep inti & bab pembelajaran...</span>
                  <span className="text-[#7C3AED] dark:text-violet-400 font-bold">100% Selesai</span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                  <div className="h-full w-full rounded-full bg-gradient-to-r from-violet-500 to-[#7C3AED]" />
                </div>
              </div>
            </div>

            {/* Bottom Row: 2 Mini Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Card 1: Flashcards */}
              <div className="anim-hover-lift rounded-3xl bg-white dark:bg-[#161528] border border-gray-200/80 dark:border-white/10 p-6 sm:p-7 flex flex-col gap-3.5 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950/80 text-[#7C3AED] dark:text-violet-400 flex items-center justify-center">
                  <Layers size={20} />
                </div>
                <h4 className="font-bold text-lg text-[#1A1A2E] dark:text-white">
                  {dict.featuresBento.flashcardsTitle}
                </h4>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {dict.featuresBento.flashcardsDesc}
                </p>
              </div>

              {/* Card 2: Kuis */}
              <div className="anim-hover-lift rounded-3xl bg-white dark:bg-[#161528] border border-gray-200/80 dark:border-white/10 p-6 sm:p-7 flex flex-col gap-3.5 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <HelpCircle size={20} />
                </div>
                <h4 className="font-bold text-lg text-[#1A1A2E] dark:text-white">
                  {dict.featuresBento.quizTitle}
                </h4>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {dict.featuresBento.quizDesc}
                </p>
              </div>
            </div>
          </div>

          {/* Right Column (span 5): 24/7 Socratic Tutor Interactive Demo */}
          <div className="lg:col-span-5 rounded-3xl bg-white dark:bg-[#161528] border border-gray-200/80 dark:border-white/10 p-6 sm:p-8 flex flex-col justify-between gap-5 shadow-sm">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <MessageCircle size={20} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#7C3AED] dark:text-violet-400 bg-violet-50 dark:bg-violet-950/50 px-2.5 py-1 rounded-full border border-violet-200/70 dark:border-violet-800/40">
                  Coba Langsung
                </span>
              </div>
              <h3 className="font-bold text-xl sm:text-2xl text-[#1A1A2E] dark:text-white tracking-tight">
                {dict.featuresBento.tutorTitle}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {dict.featuresBento.tutorDesc}
              </p>
            </div>

            {/* Simulated Socratic Dialogue */}
            <div className="rounded-2xl bg-gray-50/80 dark:bg-[#110F20] border border-gray-200/80 dark:border-white/10 p-4 space-y-3">
              {/* User Question */}
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 text-gray-600 dark:text-gray-300">
                  <User size={13} />
                </div>
                <div className="flex-1 bg-white dark:bg-[#18162B] p-2.5 rounded-2xl rounded-tl-sm border border-gray-200/60 dark:border-white/5 text-xs text-gray-800 dark:text-gray-100 font-medium">
                  {chatHistory.question}
                </div>
              </div>

              {/* Eureka Socratic Response */}
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-[#7C3AED] flex items-center justify-center flex-shrink-0 text-white">
                  <Bot size={13} />
                </div>
                <div className="flex-1 bg-violet-50/90 dark:bg-violet-950/40 p-2.5 rounded-2xl rounded-tl-sm border border-violet-200/60 dark:border-violet-800/40 text-xs text-gray-700 dark:text-gray-200 leading-relaxed">
                  <p className="font-semibold text-[#7C3AED] dark:text-violet-300 text-[10px] mb-1 uppercase tracking-wider">
                    Pertanyaan Pemandu:
                  </p>
                  {chatHistory.socraticAnswer}
                </div>
              </div>
            </div>

            {/* Interactive Prompt Pills & Input Box */}
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "langit", label: "Langit biru" },
                  { id: "kalkulus", label: "Turunan vs Integral" },
                  { id: "ekonomi", label: "Hukum kelangkaan" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectPrompt(item.id)}
                    className={`anim-press px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                      activeKey === item.id
                        ? "bg-violet-100 dark:bg-violet-900/40 text-[#7C3AED] dark:text-violet-300 border-violet-300 dark:border-violet-700"
                        : "bg-gray-100/70 dark:bg-white/5 text-gray-600 dark:text-gray-400 border-transparent hover:border-gray-200"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Input Box */}
              <form onSubmit={handleCustomSubmit} className="relative flex items-center">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Ketik pertanyaan belajarmu..."
                  className="w-full h-11 pl-3.5 pr-11 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-white/5 text-xs text-[#1A1A2E] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button
                  type="submit"
                  aria-label="Kirim pertanyaan"
                  className="anim-press absolute right-1.5 w-8 h-8 rounded-lg bg-[#7C3AED] text-white flex items-center justify-center hover:bg-[#6D28D9]"
                >
                  <ArrowUp size={14} />
                </button>
              </form>

              <Link
                href={ctaHref}
                className="anim-press w-full h-10 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] active:bg-[#5B21B6] text-white text-xs font-semibold flex items-center justify-center transition-colors shadow-sm"
              >
                {dict.featuresBento.tutorCta}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
