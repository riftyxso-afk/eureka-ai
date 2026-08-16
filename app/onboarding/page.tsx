"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  AtSign,
  BarChart3,
  Bot,
  Brain,
  CheckCircle2,
  Crown,
  Lightbulb,
  Loader2,
  PartyPopper,
  XCircle,
} from "lucide-react";
import ButtonClay from "@/components/ui/ButtonClay";
import CardClay from "@/components/ui/CardClay";
import InputClay from "@/components/ui/InputClay";
import ProgressBarClay from "@/components/ui/ProgressBarClay";

import { useOnboarding } from "@/context/OnboardingContext";
import {
  ONBOARDING_STEPS,
  LOADING_TEXTS,
  PSY_QUESTIONS,
  gradeOptionsFor,
  isUsernameValid,
  normalizeUsername,
  usernameHint,
} from "@/lib/onboardingContent";
import { getSession, updateSessionName } from "@/lib/auth";
import { getUserId } from "@/lib/identity";
import { emojiToIcon } from "@/lib/emojiIcon";
import { playCelebrationSound } from "@/lib/notifySound";

type Phase = "form" | "loading" | "result";

interface AnalysisRecommendation {
  icon: string;
  title: string;
  desc: string;
}

interface ProfileAnalysis {
  tagline: string;
  learningStyle: string;
  psyLabel?: string;
  psySummary?: string;
  recommendations: AnalysisRecommendation[];
  studyTips: string[];
}

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

const ANALYSIS_STORAGE_KEY = "eureka_profile_analysis";

const DEFAULT_ANALYSIS: ProfileAnalysis = {
  tagline: "Tutor Socratic-mu siap bikin kamu paham, bukan cuma hafal!",
  learningStyle:
    "Profil belajarmu sudah tercatat. Saat materi baru masuk, Eureka akan menyesuaikan cara membimbingmu.",
  psyLabel: "Si Penasaran Adaptif",
  psySummary:
    "Kamu belajar paling nyaman saat bebas mengeksplorasi dengan caramu sendiri. Eureka akan menyesuaikan ritmenya denganmu.",
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
      psyLabel: parsed.psyLabel || DEFAULT_ANALYSIS.psyLabel,
      psySummary: parsed.psySummary || DEFAULT_ANALYSIS.psySummary,
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
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [userNumber, setUserNumber] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const analyzedRef = useRef(false);

  const current = ONBOARDING_STEPS[step];
  const psyQuestion =
    current.key === "psyTest" && current.psyIndex != null
      ? PSY_QUESTIONS[current.psyIndex]
      : null;
  const psyAnswers = data.psyAnswers ?? {};
  const gradeOptions =
    current.key === "grade" ? gradeOptionsFor(data.education) : current.options;

  // Cek ketersediaan username (debounce) + cek status onboarding.
  const cleanUsername = normalizeUsername(data.username);
  useEffect(() => {
    if (!cleanUsername) {
      setUsernameStatus("idle");
      return;
    }
    if (usernameHint(cleanUsername)) {
      setUsernameStatus("invalid");
      return;
    }
    setUsernameStatus("checking");
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch(
          `/api/profile?userId=${encodeURIComponent(
            getUserId()
          )}&checkUsername=${encodeURIComponent(cleanUsername)}`
        );
        const payload = await res.json();
        setUsernameStatus(payload.available ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [cleanUsername]);

  // Sudah pernah onboarding → langsung ke dashboard.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/profile?userId=${encodeURIComponent(getUserId())}`);
        const payload = await res.json();
        if (!cancelled && payload?.user?.onboardingCompleted) {
          router.replace("/home");
        }
      } catch {
        // biarkan (profil belum tersimpan)
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

   const saveProfile = useCallback(
     async (nextAnalysis: ProfileAnalysis | null) => {
       try {
         const res = await apiFetch("/api/profile", {
           method: "PUT",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({
             userId: getUserId(),
             email: getSession()?.email ?? "",
             name: data.name,
             username: cleanUsername,
              profileData: {
                education: data.education,
                grade: data.grade,
                psyAnswers: data.psyAnswers,
                weakTopic: data.weakTopic,
                learningHabit: data.learningHabit,
                peakHour: data.peakHour,
                analysis: nextAnalysis,
              },
           }),
         });
         const payload = await res.json();
         if (!res.ok) throw new Error(payload?.error ?? "Gagal menyimpan profil.");
         if (payload?.user?.userNumber != null) {
           setUserNumber(Number(payload.user.userNumber));
         }
         // Sinkronkan nama ke sesi lokal agar home/chat/sidebar konsisten.
         updateSessionName(data.name);
         return true;
       } catch (e) {
         const msg = e instanceof Error ? e.message : "Gagal menyimpan profil.";
         if (msg.includes("sudah dipakai")) {
           setUsernameStatus("taken");
           setStep((s) => Math.min(s, ONBOARDING_STEPS.findIndex((st) => st.key === "username")));
         }
         setSaveError(msg);
         return false;
       }
     },
     [data, cleanUsername]
   );

  const runAnalysis = useCallback(async () => {
    if (analyzedRef.current) return;
    analyzedRef.current = true;
    // Beri waktu minimal untuk animasi loading (loadingIdx maju tiap 1.4s).
    const minWait = new Promise((r) => setTimeout(r, 4800));
    const [res] = await Promise.all([
      apiFetch("/api/onboarding/analyze", {
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
            psyLabel:
              payload.analysis.psyLabel || DEFAULT_ANALYSIS.psyLabel,
            psySummary:
              payload.analysis.psySummary || DEFAULT_ANALYSIS.psySummary,
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
    await saveProfile(next);
    try {
      window.localStorage.setItem(ANALYSIS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable
    }
  }, [data, saveProfile]);

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

  // Notifikasi suara saat onboarding selesai & nomor user sudah diketahui.
  const playedSoundRef = useRef(false);
  const playedNotifRef = useRef(false);
  useEffect(() => {
    if (phase !== "result") return;
    if (!playedSoundRef.current) {
      playedSoundRef.current = true;
      playCelebrationSound();
    }
    if (
      !playedNotifRef.current &&
      userNumber != null &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      playedNotifRef.current = true;
      try {
        new Notification("Selamat datang di Eureka.AI!", {
          body: `Kamu pengguna ke-${userNumber} yang bergabung.`,
        });
      } catch {
        // abaikan — notifikasi opsional
      }
    }
  }, [phase, userNumber]);

  const canProceed =
    current.key === "name"
      ? data.name.trim().length >= 2
      : current.key === "username"
        ? usernameStatus === "available"
        : current.key === "grade" && !data.education
          ? false
          : current.key === "psyTest" && psyQuestion
            ? Boolean(psyAnswers[psyQuestion.id])
            : Boolean(data[current.key as Exclude<keyof typeof data, "psyAnswers">]);

  const next = () => {
    if (!canProceed) return;
    if (step < ONBOARDING_STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      setPhase("loading");
    }
  };

  const choosePlan = async (plan: "pro" | "free") => {
    try {
      localStorage.setItem("eureka_plan", plan);
    } catch {
      // storage unavailable
    }
    try {
      const res = await apiFetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: getUserId(),
          email: getSession()?.email ?? "",
          name: data.name,
          username: cleanUsername,
          plan,
          onboardingCompleted: true,
          profileData: {
            education: data.education,
            grade: data.grade,
            psyAnswers: data.psyAnswers,
            weakTopic: data.weakTopic,
            learningHabit: data.learningHabit,
            peakHour: data.peakHour,
            analysis,
          },
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.user?.onboardingCompleted) {
        setSaveError(payload?.error ?? "Gagal menyelesaikan onboarding. Coba lagi.");
        return;
      }
      // Sinkronkan nama ke sesi lokal agar home/chat/sidebar konsisten.
      updateSessionName(data.name);
    } catch {
      setSaveError("Gagal menyimpan profil. Coba lagi.");
      return;
    }
    // Tandai supaya halaman dashboard menampilkan layar "Menyiapkan dashboardmu...".
    try {
      sessionStorage.setItem("eureka_dashboard_prepare", "1");
    } catch {
      // abaikan
    }
    router.replace("/home");
  };

  const progressValue =
    phase === "form" ? step : Math.min(loadingIdx + 1, LOADING_TEXTS.length);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[560px]">
        <div className="mb-8 flex items-center justify-center gap-3">
          <img src="/logo.png" alt="Logo Eureka.AI" className="h-11 w-11 object-contain" />
          <span className="text-2xl font-extrabold text-clay-dark">
            Eureka<span className="text-clay-primary">.AI</span>
          </span>
        </div>

        <ProgressBarClay value={progressValue} max={ONBOARDING_STEPS.length} />
        <p className="mt-3 text-center text-sm font-bold text-clay-muted">
          {phase === "form"
            ? `Langkah ${step + 1} dari ${ONBOARDING_STEPS.length}`
            : "Menyiapkan pengalaman belajarmu..."}
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
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-clay-primary/10 text-clay-primary">
                  {(() => {
                    const StepIcon = emojiToIcon(current.emoji);
                    return <StepIcon size={38} />;
                  })()}
                </div>
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
                ) : current.key === "username" ? (
                  <div className="mt-6">
                    <div className="relative">
                      <AtSign
                        size={18}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-clay-muted"
                      />
                      <InputClay
                        type="text"
                        inputMode="text"
                        autoComplete="username"
                        placeholder="usernamekamu"
                        value={data.username}
                        onChange={(e) =>
                          update({
                            username: normalizeUsername(e.target.value),
                          })
                        }
                        onKeyDown={(e) => e.key === "Enter" && next()}
                        className="!pl-11"
                        autoFocus
                      />
                    </div>
                    <div className="mt-2 min-h-[24px]">
                      {usernameStatus === "checking" && (
                        <p className="flex items-center gap-2 text-sm font-bold text-clay-muted">
                          <Loader2 size={14} className="animate-spin" />
                          Mengecek ketersediaan...
                        </p>
                      )}
                      {usernameStatus === "available" && (
                        <p className="flex items-center gap-2 text-sm font-bold text-clay-success">
                          <CheckCircle2 size={14} />
                          @{cleanUsername} tersedia!
                        </p>
                      )}
                      {usernameStatus === "taken" && (
                        <p className="flex items-center gap-2 text-sm font-bold text-red-500">
                          <XCircle size={14} />
                          @{cleanUsername} sudah dipakai. Coba yang lain.
                        </p>
                      )}
                      {usernameStatus === "invalid" && (
                        <p className="flex items-center gap-2 text-sm font-bold text-clay-secondary">
                          <XCircle size={14} />
                          Hanya huruf kecil, angka, dan _ (3–20 karakter).
                        </p>
                      )}
                    </div>
                  </div>
                ) : current.key === "psyTest" && psyQuestion ? (
                  <div className="mt-6 flex flex-col gap-4">
                    <p className="text-xs font-extrabold uppercase tracking-widest text-clay-primary">
                      Tes Kepribadian Belajar · Soal {(current.psyIndex ?? 0) + 1}/{PSY_QUESTIONS.length}
                    </p>
                    {psyQuestion.options.map((opt) => {
                      const selected = psyAnswers[psyQuestion.id] === opt.trait;
                      return (
                        <button
                          key={opt.trait}
                          type="button"
                          onClick={() => {
                            update({
                              psyAnswers: { ...psyAnswers, [psyQuestion.id]: opt.trait },
                            });
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
                ) : (
                  <div className="mt-6 flex flex-col gap-4">
                    {gradeOptions?.map((opt) => {
                      const selected =
                        data[current.key as Exclude<keyof typeof data, "psyAnswers">] ===
                        opt.value;
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
                    <ArrowLeft size={16} className="mr-2" /> Kembali
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
                  Lanjut <ArrowRight size={16} className="ml-2" />
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
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-clay-primary text-white shadow-clay-btn">
                      <Bot size={34} />
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
                {userNumber != null && (
                  <motion.div
                    initial={{ opacity: 0, y: -12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.35, delay: 0.15 }}
                    className="mb-5 flex items-center gap-3 rounded-clay-md border-2 border-clay-success/40 bg-clay-success/10 px-4 py-3 shadow-clay-sm"
                  >
                    <PartyPopper size={22} className="shrink-0 text-clay-success" />
                    <p className="text-sm font-extrabold text-clay-dark">
                      Kamu pengguna ke-{userNumber} di Eureka.AI! Selamat bergabung
                    </p>
                  </motion.div>
                )}
                <div className="text-center">
                  <div className="flex justify-center">
                    <PartyPopper size={52} className="text-clay-secondary" />
                  </div>
                  <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">
                    Profil Selesai, {data.name.split(" ")[0]}!
                  </h1>
                  <p className="mt-2 text-sm font-extrabold text-clay-primary">
                    @{cleanUsername}
                    {userNumber != null && (
                      <span className="ml-3 rounded-full bg-clay-primary/10 px-3 py-1 text-xs">
                        Pengguna ke-{userNumber} di Eureka.AI
                      </span>
                    )}
                  </p>
                  <p className="mt-3 text-lg font-semibold text-clay-muted">
                    {analysis?.tagline || DEFAULT_ANALYSIS.tagline}
                  </p>
                </div>

                {saveError && (
                  <div className="mt-6 flex items-center gap-2 rounded-clay-md border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                    <AlertTriangle size={16} className="shrink-0" /> {saveError}
                  </div>
                )}

                {/* Tipe kepribadian belajar dari tes psikologi */}
                <div className="mt-6 rounded-clay-md border-2 border-clay-secondary/40 bg-clay-secondary/5 p-5 text-center shadow-clay-sm">
                  <p className="flex items-center justify-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-clay-muted">
                    <Brain size={14} className="text-clay-secondary" /> Tipe Kepribadian Belajarmu
                  </p>
                  <h2 className="mt-2 text-2xl font-extrabold text-clay-secondary">
                    {analysis?.psyLabel || DEFAULT_ANALYSIS.psyLabel}
                  </h2>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-clay-dark">
                    {analysis?.psySummary || DEFAULT_ANALYSIS.psySummary}
                  </p>
                </div>

                {/* Analisis pribadi dari AI */}
                <div className="mt-6 rounded-clay-md border-2 border-clay-primary/30 bg-clay-primary/5 p-5 shadow-clay-sm">
                  <p className="flex items-center justify-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-clay-primary">
                    <BarChart3 size={14} /> Hasil Analisis AI
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-clay-dark">
                    {analysis?.learningStyle || DEFAULT_ANALYSIS.learningStyle}
                  </p>
                </div>

                <div className="mt-6 flex flex-col gap-4">
                  {(analysis?.recommendations ?? DEFAULT_ANALYSIS.recommendations).map(
                    (f) => {
                      const RecIcon = emojiToIcon(f.icon);
                      return (
                        <div
                          key={f.title}
                          className="flex items-start gap-4 rounded-clay-md bg-clay-beige/70 p-5 shadow-clay-sm"
                        >
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-clay-primary/10 text-clay-primary">
                            <RecIcon size={22} />
                          </span>
                          <div>
                            <h3 className="text-lg font-extrabold">{f.title}</h3>
                            <p className="text-sm font-semibold text-clay-muted">
                              {f.desc}
                            </p>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>

                {(analysis?.studyTips ?? DEFAULT_ANALYSIS.studyTips).length >
                  0 && (
                  <div className="mt-6 rounded-clay-md bg-clay-inputBg p-5 shadow-clay-inset">
                    <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-clay-muted">
                      <Lightbulb size={14} className="text-clay-secondary" /> Tips Belajarmu
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
                    <Crown size={18} className="mr-2" /> Mulai Pro Sekarang
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
