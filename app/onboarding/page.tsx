"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import ButtonClay from "@/components/ui/ButtonClay";
import CardClay from "@/components/ui/CardClay";
import InputClay from "@/components/ui/InputClay";
import ProgressBarClay from "@/components/ui/ProgressBarClay";
import AvatarClay from "@/components/ui/AvatarClay";
import { useOnboarding } from "@/context/OnboardingContext";
import { ONBOARDING_STEPS, LOADING_TEXTS } from "@/lib/onboardingContent";

type Phase = "form" | "loading" | "result";

interface AnalysisRecommendation {
  icon: string;
  title: string;
  desc: string;
}

interface ProfileAnalysis {
  tagline: string;
  learningStyle: string;
  recommendations: AnalysisRecommendation[];
  studyTips: string[];
}

const ANALYSIS_STORAGE_KEY = "eureka_profile_analysis";

const DEFAULT_ANALYSIS: ProfileAnalysis = {
  tagline: "Tutor Socratic-mu siap bikin kamu paham, bukan cuma hafal!",
  learningStyle:
    "Profil belajarmu sudah tercatat. Saat materi baru masuk, Eureka akan menyesuaikan cara membimbingmu.",
  recommendations: [
    {
      icon: "🧠",
      title: "Socratic AI",
      desc: "Bertanya balik, BUKAN kasih jawaban instan.",
    },
    {
      icon: "📋",
      title: "Agentic Planner",
      desc: "AI bikin rencana belajar 3 hari ke depan khusus buat kamu.",
    },
    {
      icon: "🎯",
      title: "Fokus di Kelemahanmu",
      desc: "Kami catat topik yang kamu pusingin untuk dipelajari pertama.",
    },
    {
      icon: "👁️",
      title: "Reasoning Trace",
      desc: "Lihat alur pikir AI step-by-step di balik layar.",
    },
  ],
  studyTips: [
    "Belajar rutin 25 menit per sesi lebih efektif daripada maraton panjang.",
  ],
};

function readStoredAnalysis(): ProfileAnalysis | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ANALYSIS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ProfileAnalysis>;
    return {
      tagline: parsed.tagline || DEFAULT_ANALYSIS.tagline,
      learningStyle: parsed.learningStyle || DEFAULT_ANALYSIS.learningStyle,
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations
        : DEFAULT_ANALYSIS.recommendations,
      studyTips: Array.isArray(parsed.studyTips)
        ? parsed.studyTips
        : DEFAULT_ANALYSIS.studyTips,
    };
  } catch {
    return null;
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const { data, update } = useOnboarding();
  const [phase, setPhase] = useState<Phase>("form");
  const [step, setStep] = useState(0);
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [analysis, setAnalysis] = useState<ProfileAnalysis | null>(
    readStoredAnalysis
  );
  const analyzedRef = useRef(false);

  const current = ONBOARDING_STEPS[step];

  const runAnalysis = useCallback(async () => {
    if (analyzedRef.current) return;
    analyzedRef.current = true;
    // Beri waktu minimal untuk animasi loading (loadingIdx maju tiap 1.4s).
    const minWait = new Promise((r) => setTimeout(r, 4800));
    const [res] = await Promise.all([
      fetch("/api/onboarding/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).catch(() => null),
      minWait,
    ]);
    let next: ProfileAnalysis = DEFAULT_ANALYSIS;
    if (res?.ok) {
      try {
        const payload = await res.json();
        if (payload.analysis) {
          next = {
            tagline:
              payload.analysis.tagline || DEFAULT_ANALYSIS.tagline,
            learningStyle:
              payload.analysis.learningStyle || DEFAULT_ANALYSIS.learningStyle,
            recommendations: Array.isArray(payload.analysis.recommendations)
              ? payload.analysis.recommendations
              : DEFAULT_ANALYSIS.recommendations,
            studyTips: Array.isArray(payload.analysis.studyTips)
              ? payload.analysis.studyTips
              : DEFAULT_ANALYSIS.studyTips,
          };
        }
      } catch {
        // biarkan fallback
      }
    }
    setAnalysis(next);
    try {
      window.localStorage.setItem(ANALYSIS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable
    }
  }, [data]);

  useEffect(() => {
    if (phase !== "loading") return;
    if (loadingIdx < LOADING_TEXTS.length - 1) {
      const t = setTimeout(() => setLoadingIdx((i) => i + 1), 1400);
      return () => clearTimeout(t);
    }
    runAnalysis();
    const t = setTimeout(() => setPhase("result"), 1600);
    return () => clearTimeout(t);
  }, [phase, loadingIdx, runAnalysis]);

  const canProceed =
    current.key === "name"
      ? data.name.trim().length >= 2
      : Boolean(data[current.key]);

  const next = () => {
    if (!canProceed) return;
    if (step < ONBOARDING_STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      setPhase("loading");
    }
  };

  const choosePlan = (plan: "pro" | "free") => {
    try {
      localStorage.setItem("eureka_plan", plan);
    } catch {
      // storage unavailable
    }
    router.push("/dashboard");
  };

  const progressValue =
    phase === "form" ? step : Math.min(loadingIdx + 1, LOADING_TEXTS.length);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[560px]">
        <div className="mb-8 flex items-center justify-center gap-3">
          <AvatarClay name="Eureka" size={44} />
          <span className="text-2xl font-extrabold text-clay-dark">
            Eureka<span className="text-clay-primary">.AI</span>
          </span>
        </div>

        <ProgressBarClay value={progressValue} max={5} />
        <p className="mt-3 text-center text-sm font-bold text-clay-muted">
          {phase === "form" ? `Langkah ${step + 1} dari 5` : "Menyiapkan pengalaman belajarmu..."}
        </p>

        <AnimatePresence mode="wait">
          {phase === "form" && (
            <motion.div
              key={`form-${step}`}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
            >
              <CardClay className="mt-6">
                <div className="text-5xl">{current.emoji}</div>
                <h1 className="mt-4 text-3xl font-extrabold leading-tight">
                  {current.question}
                </h1>
                {current.subtitle && (
                  <p className="mt-2 text-lg font-semibold text-clay-muted">
                    {current.subtitle}
                  </p>
                )}

                {current.key === "name" ? (
                  <div className="mt-6">
                    <InputClay
                      type="text"
                      placeholder="Tulis namamu..."
                      value={data.name}
                      onChange={(e) => update({ name: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && next()}
                      autoFocus
                    />
                    {data.name.trim().length > 0 &&
                      data.name.trim().length < 2 && (
                        <p className="mt-2 text-sm font-bold text-clay-secondary">
                          Minimal 2 huruf ya
                        </p>
                      )}
                  </div>
                ) : (
                  <div className="mt-6 flex flex-col gap-4">
                    {current.options?.map((opt) => {
                      const selected = data[current.key] === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            update({ [current.key]: opt.value } as never);
                            if (step < ONBOARDING_STEPS.length - 1) {
                              setStep((s) => s + 1);
                            } else {
                              setPhase("loading");
                            }
                          }}
                          className={`flex w-full items-center gap-3 rounded-clay-md border-3 px-5 py-4 text-left text-base font-bold transition-all duration-75 active:translate-y-1 ${
                            selected
                              ? "border-clay-primary bg-clay-primary/10 shadow-clay-sm"
                              : "border-clay-borderLight bg-white shadow-clay-sm hover:-translate-y-0.5"
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-3 transition-colors ${
                              selected
                                ? "border-clay-primary bg-clay-primary"
                                : "border-clay-shadow bg-white"
                            }`}
                          >
                            {selected && (
                              <span className="text-xs text-white">✓</span>
                            )}
                          </span>
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardClay>

              <div className="mt-8 flex items-center justify-between gap-4">
                {step > 0 ? (
                  <ButtonClay
                    variant="secondary"
                    onClick={() => setStep((s) => s - 1)}
                    className="shrink-0"
                  >
                    ⬅ Kembali
                  </ButtonClay>
                ) : (
                  <div className="hidden sm:block" />
                )}
                <ButtonClay
                  onClick={next}
                  disabled={!canProceed}
                  fullWidth={step === 0}
                  className={step > 0 ? "flex-1" : ""}
                >
                  Lanjut ➜
                </ButtonClay>
              </div>
            </motion.div>
          )}

          {phase === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <CardClay className="mt-6">
                <div className="flex flex-col items-center py-6">
                  <div className="relative h-20 w-20">
                    <div className="absolute inset-0 animate-ping rounded-full bg-clay-primary/30" />
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-clay-primary text-3xl shadow-clay-btn">
                      🤖
                    </div>
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={loadingIdx}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.3 }}
                      className="mt-10 min-h-[32px] text-center text-xl font-extrabold"
                    >
                      {LOADING_TEXTS[loadingIdx]}
                    </motion.p>
                  </AnimatePresence>
                  <div className="mt-8 w-full max-w-xs">
                    <ProgressBarClay
                      value={loadingIdx + 1}
                      max={LOADING_TEXTS.length}
                    />
                  </div>
                </div>
              </CardClay>
            </motion.div>
          )}

          {phase === "result" && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <CardClay className="mt-6">
                <div className="text-center">
                  <div className="text-6xl">🎉</div>
                  <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">
                    Profil Selesai, {data.name.split(" ")[0]}!
                  </h1>
                  <p className="mt-3 text-lg font-semibold text-clay-muted">
                    {analysis?.tagline || DEFAULT_ANALYSIS.tagline}
                  </p>
                </div>

                {/* Analisis pribadi dari AI */}
                <div className="mt-6 rounded-clay-md border-2 border-clay-primary/30 bg-clay-primary/5 p-5 shadow-clay-sm">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-clay-primary">
                    📊 Hasil Analisis AI
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-clay-dark">
                    {analysis?.learningStyle || DEFAULT_ANALYSIS.learningStyle}
                  </p>
                </div>

                <div className="mt-6 flex flex-col gap-4">
                  {(analysis?.recommendations ?? DEFAULT_ANALYSIS.recommendations).map((f) => (
                    <div
                      key={f.title}
                      className="flex items-start gap-4 rounded-clay-md bg-clay-beige/70 p-5 shadow-clay-sm"
                    >
                      <span className="text-3xl">{f.icon}</span>
                      <div>
                        <h3 className="text-lg font-extrabold">{f.title}</h3>
                        <p className="text-sm font-semibold text-clay-muted">
                          {f.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {(analysis?.studyTips ?? DEFAULT_ANALYSIS.studyTips).length >
                  0 && (
                  <div className="mt-6 rounded-clay-md bg-clay-inputBg p-5 shadow-clay-inset">
                    <p className="text-xs font-extrabold uppercase tracking-widest text-clay-muted">
                      💡 Tips Belajarmu
                    </p>
                    <ul className="mt-2 space-y-2">
                      {(analysis?.studyTips ?? DEFAULT_ANALYSIS.studyTips).map(
                        (tip, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm font-semibold text-clay-dark"
                          >
                            <span className="text-clay-primary">•</span>
                            <span>{tip}</span>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}

                <div className="mt-6 rounded-clay-md border-2 border-clay-borderLight bg-clay-primary/5 p-6 text-center shadow-clay-sm">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-clay-muted">
                    Paket Pro
                  </p>
                  <p className="mt-1 text-4xl font-extrabold">
                    Rp 59.000
                    <span className="text-lg font-bold text-clay-muted">
                      /bulan
                    </span>
                  </p>
                  <p className="mt-1 text-sm font-bold text-clay-muted">
                    Sesi tak terbatas + prioritas fitur baru
                  </p>
                </div>

                <div className="mt-6 flex flex-col gap-4">
                  <ButtonClay fullWidth onClick={() => choosePlan("pro")}>
                    👑 Mulai Pro Sekarang
                  </ButtonClay>
                  <ButtonClay
                    fullWidth
                    variant="secondary"
                    onClick={() => choosePlan("free")}
                  >
                    Nanti aja, pakai gratisan dulu
                  </ButtonClay>
                </div>
              </CardClay>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
