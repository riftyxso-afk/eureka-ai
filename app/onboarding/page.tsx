"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import ButtonClay from "@/components/ui/ButtonClay";
import CardClay from "@/components/ui/CardClay";
import InputClay from "@/components/ui/InputClay";
import ProgressBarClay from "@/components/ui/ProgressBarClay";
import AvatarClay from "@/components/ui/AvatarClay";
import { useOnboarding } from "@/context/OnboardingContext";
import {
  ONBOARDING_STEPS,
  LOADING_TEXTS,
  RESULT_FEATURES,
} from "@/lib/onboardingContent";

type Phase = "form" | "loading" | "result";

export default function OnboardingPage() {
  const router = useRouter();
  const { data, update } = useOnboarding();
  const [phase, setPhase] = useState<Phase>("form");
  const [step, setStep] = useState(0);
  const [loadingIdx, setLoadingIdx] = useState(0);

  const current = ONBOARDING_STEPS[step];

  useEffect(() => {
    if (phase !== "loading") return;
    if (loadingIdx < LOADING_TEXTS.length - 1) {
      const t = setTimeout(() => setLoadingIdx((i) => i + 1), 1500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPhase("result"), 1600);
    return () => clearTimeout(t);
  }, [phase, loadingIdx]);

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
                    Tutor Socratic-mu siap bikin kamu paham, bukan cuma hafal!
                  </p>
                </div>

                <div className="mt-8 flex flex-col gap-4">
                  {RESULT_FEATURES.map((f) => (
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

                <div className="mt-8 rounded-clay-md border-2 border-clay-borderLight bg-clay-primary/5 p-6 text-center shadow-clay-sm">
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
