"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Layers,
  HelpCircle,
  Sparkles,
  CheckCircle2,
  RotateCw,
} from "lucide-react";
import { useI18n } from "@/context/LocaleContext";

interface HeroSectionProps {
  loggedIn: boolean;
  ctaHref: string;
}

type MockupMode = "summary" | "flashcard" | "quiz";

interface Topic {
  id: string;
  badge: string;
  source: string;
  title: string;
  summaryPoints: string[];
  flashcard: { q: string; a: string };
  quiz: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

const TOPICS: Topic[] = [
  {
    id: "sejarah",
    badge: "Sejarah",
    source: "YouTube · 14 menit video",
    title: "Kenapa Indonesia Dijajah 350 Tahun?",
    summaryPoints: [
      "Mitos 350 tahun berasal dari pidato politis Belanda, bukan penjajahan serempak seluruh kepulauan.",
      "VOC awalnya datang murni sebagai kongsi dagang rempah-rempah (monopoli pala & cengkeh di Maluku).",
      "Perlawanan daerah terpecah akibat politik adu domba (Devide et Impera) sebelum Kebangkitan Nasional 1908.",
    ],
    flashcard: {
      q: "Kapan VOC resmi dibubarkan dan kekuasaan diambil alih oleh Kerajaan Belanda?",
      a: "31 Desember 1799 — akibat korupsi merajalela dan beban utang perang yang membengkak.",
    },
    quiz: {
      question: "Apa strategi utama VOC dalam menguasai kerajaan-kerajaan nusantara?",
      options: [
        "Invasi militer serentak ke seluruh pulau",
        "Politik adu domba (Devide et Impera) internal kerajaan",
        "Penyebaran budaya dan bahasa Belanda",
      ],
      correctIndex: 1,
      explanation: "VOC memanfaatkan perebutan tahta internal kerajaan dan menawarkan bantuan bersyarat monopoli dagang.",
    },
  },
  {
    id: "matematika",
    badge: "Matematika",
    source: "PDF Modul · 18 halaman",
    title: "Turunan Fungsi Aljabar: Konsep & Grafik",
    summaryPoints: [
      "Turunan f'(x) adalah laju perubahan sesaat nilai fungsi terhadap variabel x.",
      "Secara geometris, f'(a) mewakili gradien garis singgung kurva di titik x = a.",
      "Aturan dasar: jika f(x) = a·xⁿ, maka turunan pertamanya f'(x) = a·n·xⁿ⁻¹.",
    ],
    flashcard: {
      q: "Jika posisi benda s(t) = 3t² + 4t, berapakah kecepatan v(t) saat t = 2 detik?",
      a: "v(t) = s'(t) = 6t + 4. Pada t = 2, kecepatannya adalah 6(2) + 4 = 16 m/s.",
    },
    quiz: {
      question: "Apa turunan pertama dari f(x) = 5x³ - 4x + 7?",
      options: [
        "15x² - 4",
        "15x³ - 4",
        "5x² - 4",
      ],
      correctIndex: 0,
      explanation: "d/dx(5x³) = 15x², d/dx(-4x) = -4, dan turunan konstanta 7 adalah 0.",
    },
  },
  {
    id: "fisika",
    badge: "Fisika",
    source: "Dokumen Kuliah · 12 slide",
    title: "Hukum Gerak Newton & Gravitasi Semesta",
    summaryPoints: [
      "Hukum I (Inersia): Benda mempertahankan keadaan diam atau gerak lurus beraturan jika resultan gaya = 0.",
      "Hukum II: Percepatan sebanding dengan gaya total dan berbanding terbalik dengan massa (ΣF = m·a).",
      "Hukum III (Aksi-Reaksi): Gaya selalu berpasangan, sama besar dan berlawanan arah pada benda berbeda.",
    ],
    flashcard: {
      q: "Mengapa astronaut di orbit ISS melayang padahal gravitasi bumi di sana masih ~90%?",
      a: "Karena astronaut dan ISS sama-sama berada dalam keadaan jatuh bebas (free fall) mengitari kelengkungan bumi.",
    },
    quiz: {
      question: "Jika gaya dorong 60 N diberikan pada balok 12 kg di lantai licin, berapa percepatannya?",
      options: [
        "5 m/s²",
        "720 m/s²",
        "0.2 m/s²",
      ],
      correctIndex: 0,
      explanation: "Berdasarkan Hukum II Newton: a = F / m = 60 N / 12 kg = 5 m/s².",
    },
  },
];

export function HeroSection({ loggedIn, ctaHref }: HeroSectionProps) {
  const { dict } = useI18n();
  const [selectedTopic, setSelectedTopic] = useState<Topic>(TOPICS[0]);
  const [mode, setMode] = useState<MockupMode>("summary");
  const [flipped, setFlipped] = useState(false);
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);

  const handleSelectTopic = (topic: Topic) => {
    setSelectedTopic(topic);
    setFlipped(false);
    setSelectedQuizOption(null);
  };

  const handleSelectMode = (nextMode: MockupMode) => {
    setMode(nextMode);
    setFlipped(false);
    setSelectedQuizOption(null);
  };

  return (
    <section
      aria-label="Hero"
      className="relative w-full pt-6 sm:pt-12 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center overflow-hidden"
    >
      {/* Background Soft Glow */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] sm:w-[1000px] h-[450px] bg-gradient-to-b from-violet-200/40 via-purple-100/20 to-transparent dark:from-violet-900/20 dark:via-purple-950/10 dark:to-transparent blur-3xl pointer-events-none -z-10"
      />

      {/* Main Headline H1 */}
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-1 sm:gap-2">
        <h1 className="font-extrabold text-4xl sm:text-6xl lg:text-[72px] tracking-tight text-[#1A1A2E] dark:text-white leading-[1.1]">
          <span>{dict.hero.h1Line1}</span>
          <span className="block mt-1 sm:mt-2">
            {dict.hero.h1Prefix}{" "}
            <span className="text-[#7C3AED] dark:text-violet-400">
              {dict.hero.h1Highlight}
            </span>
          </span>
        </h1>
        <p className="mt-4 sm:mt-6 max-w-2xl text-base sm:text-lg lg:text-xl text-gray-600 dark:text-gray-300 leading-relaxed font-normal">
          {dict.hero.subtitle}
        </p>
      </div>

      {/* Primary CTA Button with interactive press feel */}
      <div className="mt-8 flex flex-col items-center gap-3">
        <Link
          href={ctaHref}
          className="anim-press inline-flex items-center justify-center gap-2.5 h-[52px] px-8 sm:px-10 rounded-2xl bg-[#7C3AED] hover:bg-[#6D28D9] active:bg-[#5B21B6] text-white font-semibold text-base sm:text-lg shadow-[0_8px_24px_rgba(124,58,237,0.35)] hover:shadow-[0_12px_28px_rgba(124,58,237,0.45)] focus:outline-none focus:ring-4 focus:ring-violet-400/40"
        >
          <span>{loggedIn ? dict.nav.bukaDashboard : dict.hero.cta}</span>
          <ArrowRight size={20} />
        </Link>
        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-normal">
          {dict.hero.gratis}
        </span>
      </div>

      {/* Interactive App Mockup Window */}
      <div className="mt-12 sm:mt-16 w-full max-w-5xl mx-auto">
        <div className="relative rounded-3xl bg-gradient-to-br from-[#D8B4FE] via-[#9333EA] to-[#7C3AED] p-3 sm:p-6 lg:p-8 shadow-[0_24px_60px_rgba(124,58,237,0.25)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
          <div className="rounded-xl sm:rounded-2xl bg-white dark:bg-[#121124] shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden text-left flex flex-col">
            {/* macOS Chrome Header */}
            <div className="bg-[#F1F3F6] dark:bg-[#1A182F] px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3 border-b border-gray-200 dark:border-white/10">
              <div className="flex items-center gap-1.5" aria-hidden="true">
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#FF5F57] inline-block" />
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#FEBC2E] inline-block" />
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#28C840] inline-block" />
              </div>
              <div className="flex-1 max-w-md mx-auto h-6 sm:h-7 rounded-md bg-white dark:bg-[#121124] border border-gray-200/80 dark:border-white/10 px-3 flex items-center justify-between text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-mono">
                <span>app.eureka.ai/dashboard</span>
                <span className="text-[10px] text-violet-600 dark:text-violet-400 font-sans font-semibold">Demo Interaktif</span>
              </div>
              <div className="w-12 sm:w-16" />
            </div>

            {/* Window Content */}
            <div className="flex min-h-[340px] sm:min-h-[440px]">
              {/* Sidebar Mini (Pilih Topik) */}
              <div className="hidden sm:flex flex-col w-48 bg-[#FAFAFB] dark:bg-[#161528] border-r border-gray-200 dark:border-white/10 p-4 gap-3 text-xs font-medium">
                <div className="font-bold text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  Pilih Contoh Materi
                </div>
                <div className="flex flex-col gap-1.5">
                  {TOPICS.map((t) => {
                    const active = t.id === selectedTopic.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleSelectTopic(t)}
                        className={`anim-press text-left px-3 py-2 rounded-xl transition-colors flex flex-col gap-0.5 ${
                          active
                            ? "bg-violet-100/80 dark:bg-violet-900/40 text-[#7C3AED] dark:text-violet-300 font-semibold shadow-xs"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
                        }`}
                      >
                        <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500">
                          {t.badge}
                        </span>
                        <span className="truncate text-xs">{t.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 p-5 sm:p-7 flex flex-col justify-between gap-5">
                <div className="space-y-4">
                  {/* Topic Badge & Source */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-violet-100 dark:bg-violet-950/70 text-[#7C3AED] dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                        {selectedTopic.badge}
                      </span>
                      <span className="text-xs text-gray-400">
                        {selectedTopic.source}
                      </span>
                    </div>

                    {/* Mobile Topic Selector */}
                    <div className="flex sm:hidden items-center gap-1">
                      {TOPICS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleSelectTopic(t)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                            t.id === selectedTopic.id
                              ? "bg-violet-600 text-white"
                              : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300"
                          }`}
                        >
                          {t.badge}
                        </button>
                      ))}
                    </div>
                  </div>

                  <h3 className="font-bold text-base sm:text-2xl text-[#1A1A2E] dark:text-white leading-snug">
                    {selectedTopic.title}
                  </h3>

                  {/* Dynamic View: Summary, Flashcard, or Quiz */}
                  <div className="min-h-[170px] flex flex-col justify-center transition-all duration-200">
                    {mode === "summary" && (
                      <div className="space-y-2.5 animate-in fade-in duration-200">
                        {selectedTopic.summaryPoints.map((point, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2.5 text-xs sm:text-sm text-gray-700 dark:text-gray-200 leading-relaxed"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] mt-2 flex-shrink-0" />
                            <span>{point}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {mode === "flashcard" && (
                      <div
                        onClick={() => setFlipped((f) => !f)}
                        className="anim-press cursor-pointer w-full rounded-2xl border-2 border-dashed border-violet-300 dark:border-violet-800 bg-violet-50/70 dark:bg-violet-950/30 p-5 sm:p-6 flex flex-col items-center justify-center text-center gap-3 transition-colors hover:bg-violet-100/60 dark:hover:bg-violet-950/50"
                      >
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#7C3AED] dark:text-violet-300 uppercase tracking-wider">
                          <RotateCw size={13} className="animate-spin-slow" />
                          <span>{flipped ? "Jawaban (Klik untuk balik)" : "Pertanyaan (Klik kartu untuk buka jawaban)"}</span>
                        </div>
                        <p className="text-xs sm:text-base font-semibold text-[#1A1A2E] dark:text-white max-w-lg">
                          {flipped ? selectedTopic.flashcard.a : selectedTopic.flashcard.q}
                        </p>
                      </div>
                    )}

                    {mode === "quiz" && (
                      <div className="space-y-3 animate-in fade-in duration-200">
                        <p className="text-xs sm:text-sm font-bold text-[#1A1A2E] dark:text-white">
                          {selectedTopic.quiz.question}
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                          {selectedTopic.quiz.options.map((opt, oIdx) => {
                            const isSelected = selectedQuizOption === oIdx;
                            const isCorrect = oIdx === selectedTopic.quiz.correctIndex;
                            let style = "border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-white/5 hover:border-violet-300 text-gray-700 dark:text-gray-200";
                            if (selectedQuizOption !== null) {
                              if (isCorrect) {
                                style = "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold";
                              } else if (isSelected) {
                                style = "border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300";
                              }
                            }
                            return (
                              <button
                                key={oIdx}
                                type="button"
                                onClick={() => setSelectedQuizOption(oIdx)}
                                className={`anim-press text-left px-3.5 py-2 rounded-xl border text-xs sm:text-sm flex items-center justify-between transition-colors ${style}`}
                              >
                                <span>{String.fromCharCode(65 + oIdx)}. {opt}</span>
                                {selectedQuizOption !== null && isCorrect && (
                                  <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {selectedQuizOption !== null && (
                          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 bg-white/60 dark:bg-white/5 p-2 rounded-lg border border-gray-100 dark:border-white/5">
                            <strong className="text-[#7C3AED] dark:text-violet-400">Pembahasan: </strong>
                            {selectedTopic.quiz.explanation}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Interactive Mode Chips */}
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => handleSelectMode("summary")}
                    className={`anim-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      mode === "summary"
                        ? "bg-[#7C3AED] text-white border-[#7C3AED] shadow-sm"
                        : "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100"
                    }`}
                  >
                    <BookOpen size={13} />
                    <span>{dict.hero.mockupChipSummary}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectMode("flashcard")}
                    className={`anim-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      mode === "flashcard"
                        ? "bg-[#7C3AED] text-white border-[#7C3AED] shadow-sm"
                        : "bg-[#F5F3FF] dark:bg-violet-950/50 border-violet-200 dark:border-violet-800 text-[#7C3AED] dark:text-violet-300 hover:bg-violet-100"
                    }`}
                  >
                    <Layers size={13} />
                    <span>{dict.hero.mockupChipFlashcard}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectMode("quiz")}
                    className={`anim-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      mode === "quiz"
                        ? "bg-[#7C3AED] text-white border-[#7C3AED] shadow-sm"
                        : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
                    }`}
                  >
                    <HelpCircle size={13} />
                    <span>{dict.hero.mockupChipQuiz}</span>
                  </button>

                  <div className="ml-auto hidden sm:inline-flex items-center gap-1 text-xs text-gray-400">
                    <Sparkles size={13} className="text-amber-400" />
                    <span>Klik chip untuk ganti mode</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
