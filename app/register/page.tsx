"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  KeyRound,
  Loader2,
  Mail,
  Rocket,
  User,
} from "lucide-react";

import GoogleIcon from "@/components/ui/GoogleIcon";
import TurnstileCaptcha from "@/components/ui/TurnstileCaptcha";
import { isTurnstileClientConfigured } from "@/lib/captcha";
import { PageLoader } from "@/components/ui/PageLoader";
import {
  getSafeNext,
  isLoggedIn,
  needsOnboarding,
  registerFriendsIdentity,
  requestOtpLogin,
  signInWithGoogle,
  verifyOtpLogin,
} from "@/lib/auth";
import { useI18n } from "@/context/LocaleContext";

export default function RegisterPage() {
  const { dict } = useI18n();
  const a = dict.auth;
  const router = useRouter();
  const [step, setStep] = useState<"form" | "otp">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  // Kode referral dari link ?ref=... (disimpan juga ke localStorage agar
  // tetap terbawa sampai proses OTP selesai).
  const [refCode, setRefCode] = useState("");
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // CAPTCHA (Cloudflare Turnstile) — token sekali pakai, di-reset tiap submit.
  const captchaConfigured = isTurnstileClientConfigured();
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const resetCaptcha = () => {
    setCaptchaToken(null);
    setCaptchaKey((k) => k + 1);
  };

  // Pesan error dari halaman callback Google (?error=...) & kode referral
  // (?ref=...). Dibaca dari window.location (bukan useSearchParams) supaya
  // halaman tetap bisa di-prerender statis tanpa memerlukan Suspense boundary.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) setError(err);
    const ref = params.get("ref")?.trim().slice(0, 32);
    if (ref) {
      setRefCode(ref);
      try {
        window.localStorage.setItem("eureka_ref", ref);
      } catch {
        // abaikan
      }
    }
  }, []);

  // Fallback: user refresh halaman di tengah alur OTP → kode tetap terbawa.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("eureka_ref");
      if (stored) setRefCode(stored);
    } catch {
      // abaikan
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn()) {
      (async () => {
        const needOnboarding = await needsOnboarding().catch(() => false);
        router.replace(needOnboarding ? "/onboarding" : getSafeNext());
      })();
      return;
    }
    setChecked(true);
  }, [router]);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    };
  }, []);

  if (!checked) {
    return <PageLoader title={a.pageLoaderReg} />;
  }

  const primaryBtn =
    "flex w-full items-center justify-center gap-2 rounded-2xl bg-[#7C3AED] px-6 py-4 text-base font-bold text-white shadow-[0_8px_22px_rgba(124,58,237,0.35)] transition-colors hover:bg-[#6D28D9] active:bg-[#5B21B6] disabled:opacity-60";
  const fieldInput =
    "h-12 w-full rounded-xl border border-gray-200 bg-gray-50 pl-11 pr-4 text-sm font-semibold text-[#1A1A2E] outline-none transition-colors placeholder:text-gray-400 focus:border-[#7C3AED] focus:bg-white focus:ring-4 focus:ring-violet-400/20";
  const fieldLabel = "mb-2 block text-sm font-bold text-[#1A1A2E]";
  const errorBox =
    "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600";

  const startCooldown = () => {
    setCooldown(60);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1 && cooldownTimer.current) {
          clearInterval(cooldownTimer.current);
          cooldownTimer.current = null;
        }
        return c <= 1 ? 0 : c - 1;
      });
    }, 1000);
  };

  const canSend =
    name.trim().length >= 2 &&
    email.trim().length > 0 &&
    (!captchaConfigured || !!captchaToken);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || cooldown > 0) return;
    setError(null);

    if (name.trim().length < 2 || !email.trim()) {
      setError(a.errNameEmail);
      return;
    }
    if (captchaConfigured && !captchaToken) {
      setError(a.errCaptcha);
      return;
    }

    setSending(true);
    resetCaptcha(); // token sekali pakai — siapkan yang baru untuk percobaan berikutnya
    const result = await requestOtpLogin(email, name, captchaToken ?? undefined);
    setSending(false);
    if (!result.ok) {
      setError(result.error ?? a.errSend);
      return;
    }

    setStep("otp");
    setOtpCode("");
    startCooldown();
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (otpCode.trim().length !== 6) {
      setError(a.errOtp6);
      return;
    }
    if (captchaConfigured && !captchaToken) {
      setError(a.errCaptcha);
      return;
    }

    setSubmitting(true);
    resetCaptcha(); // token sekali pakai — siapkan yang baru untuk percobaan berikutnya
    const result = await verifyOtpLogin(
      email,
      otpCode,
      name,
      captchaToken ?? undefined,
      refCode || undefined
    );
    if (!result.ok) {
      setError(result.error ?? a.errVerify);
      setSubmitting(false);
      return;
    }

    // Sinkronkan identitas ke backend teman/kolaborasi.
    await registerFriendsIdentity(result.user!.name);

    router.replace("/onboarding");
  };

  const backToForm = () => {
    setStep("form");
    setOtpCode("");
    setError(null);
  };

  const handleGoogle = async () => {
    if (googleBusy) return;
    setError(null);
    setGoogleBusy(true);
    try {
      await signInWithGoogle(refCode || undefined, getSafeNext());
      // Browser sedang dialihkan ke Google; jika kembali, reset state.
      setGoogleBusy(false);
    } catch (e) {
      setGoogleBusy(false);
      setError(e instanceof Error ? e.message : a.errGoogleReg);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#7C3AED] via-[#6D28D9] to-[#5B21B6] p-12 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Logo Eureka.AI" className="h-9 w-9 rounded-full bg-white/90 object-contain p-1" />
          <span className="text-lg font-extrabold tracking-tight">
            eureka<span className="text-violet-200">.ai</span>
          </span>
        </Link>
        <div className="max-w-md">
          <p className="text-3xl font-extrabold leading-tight">{a.regTitle}</p>
          <p className="mt-4 text-base font-medium leading-relaxed text-violet-100">
            {step === "form" ? a.regSubForm : a.regSubOtp}
          </p>
        </div>
        <p className="text-xs font-semibold text-violet-200">© 2026 Eureka.AI</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-[420px]">
          <Link href="/" className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
            <img src="/logo.png" alt="Logo Eureka.AI" className="h-10 w-10 object-contain" />
            <span className="text-2xl font-extrabold text-[#1A1A2E]">
              eureka<span className="text-[#7C3AED]">.ai</span>
            </span>
          </Link>

          <div className="rounded-3xl border border-gray-200 bg-white p-7 shadow-[0_12px_40px_rgba(17,24,39,0.08)] sm:p-9">
            <h1 className="flex items-center justify-center gap-2 text-center text-2xl font-extrabold text-[#1A1A2E] sm:text-3xl">
              {a.regTitle}
              <Rocket size={24} className="shrink-0 text-[#7C3AED]" />
            </h1>
            <p className="mt-2 text-center text-sm font-medium text-gray-500">
              {step === "form" ? a.regSubForm : a.regSubOtp}
            </p>

            {step === "form" ? (
              <>
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={googleBusy}
                  className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-sm font-bold text-[#1A1A2E] transition-colors hover:bg-gray-50 disabled:opacity-60"
                >
                  {googleBusy ? (
                    <Loader2 size={18} className="animate-spin text-gray-400" />
                  ) : (
                    <GoogleIcon size={18} />
                  )}
                  {a.regGoogle}
                </button>

                <div className="my-6 flex items-center gap-3">
                  <span className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{a.or}</span>
                  <span className="h-px flex-1 bg-gray-200" />
                </div>

                <form onSubmit={handleSendOtp} className="space-y-5">
                  <div>
                    <label className={fieldLabel}>{a.fullName}</label>
                    <div className="relative">
                      <User size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        autoComplete="name"
                        placeholder={a.namePlaceholder}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={fieldInput}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className={fieldLabel}>{a.email}</label>
                    <div className="relative">
                      <Mail size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder={a.emailPlaceholder}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={fieldInput}
                        required
                      />
                    </div>
                  </div>

                  {error && <p className={errorBox}>{error}</p>}

                  <div className="flex justify-center">
                    <TurnstileCaptcha key={`reg-${captchaKey}`} onToken={setCaptchaToken} />
                  </div>

                  <button type="submit" disabled={sending || !canSend} className={primaryBtn}>
                    {sending ? <Loader2 size={20} className="animate-spin" /> : <><KeyRound size={18} />{a.regOtp}</>}
                  </button>
                </form>
              </>
            ) : (
              <form onSubmit={handleVerify} className="mt-6 space-y-5">
                <button
                  type="button"
                  onClick={backToForm}
                  className="flex items-center gap-1 text-xs font-bold text-gray-500 transition-colors hover:text-[#7C3AED]"
                >
                  <ArrowLeft size={13} />
                  {a.changeNameEmail}
                </button>
                <p className="rounded-xl bg-[#F5F3FF] px-4 py-3 text-center text-sm font-medium text-[#6D28D9]">
                  {a.otpSent}{" "}
                  <b className="text-[#1A1A2E]">{email.trim().toLowerCase()}</b>.
                  {a.regOtpSent}
                </p>
                <div>
                  <label className={fieldLabel}>{a.otpLabel}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoFocus
                    placeholder="••••••"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="h-14 w-full rounded-xl border border-gray-200 bg-gray-50 text-center text-2xl font-extrabold tracking-[0.4em] text-[#1A1A2E] outline-none transition-colors focus:border-[#7C3AED] focus:bg-white focus:ring-4 focus:ring-violet-400/20"
                  />
                </div>

                {error && <p className={errorBox}>{error}</p>}

                <div className="flex justify-center">
                  <TurnstileCaptcha key={`regv-${captchaKey}`} onToken={setCaptchaToken} />
                </div>

                <button
                  type="submit"
                  disabled={submitting || otpCode.length !== 6 || (captchaConfigured && !captchaToken)}
                  className={primaryBtn}
                >
                  {submitting ? <Loader2 size={20} className="animate-spin" /> : <><ArrowRight size={18} />{a.createAccount}</>}
                </button>

                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={sending || cooldown > 0}
                  className="w-full text-center text-xs font-bold text-gray-500 transition-colors hover:text-[#7C3AED] disabled:opacity-50"
                >
                  {sending
                    ? a.resending
                    : cooldown > 0
                      ? `${a.resendIn} ${cooldown}s`
                      : a.resend}
                </button>
              </form>
            )}
          </div>

          <p className="mt-6 text-center text-sm font-semibold text-gray-500">
            {a.haveAccount}{" "}
            <Link href="/login" className="font-bold text-[#7C3AED] underline-offset-2 hover:underline">
              {a.loginHere}
            </Link>
          </p>
          <p className="mt-3 text-center text-xs font-semibold text-gray-400">
            <Link href="/" className="transition-colors hover:text-[#7C3AED]">
              {a.backHome}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}