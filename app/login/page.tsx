"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Hand,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Mail,
} from "lucide-react";

import ButtonClay from "@/components/ui/ButtonClay";
import CardClay from "@/components/ui/CardClay";
import InputClay from "@/components/ui/InputClay";
import GoogleIcon from "@/components/ui/GoogleIcon";
import TurnstileCaptcha from "@/components/ui/TurnstileCaptcha";
import { isTurnstileClientConfigured } from "@/lib/captcha";
import { PageLoader } from "@/components/ui/PageLoader";import { getSafeNext,
  isLoggedIn,
  loginUser,
  needsOnboarding,
  requestOtpLogin,
  signInWithGoogle,
  verifyOtpLogin,
} from "@/lib/auth";
import { useI18n } from "@/context/LocaleContext";

type LoginMode = "password" | "otp";

export default function LoginPage() {
  const { dict } = useI18n();
  const a = dict.auth;
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // CAPTCHA (Cloudflare Turnstile) — token sekali pakai, di-reset tiap submit.
  const captchaConfigured = isTurnstileClientConfigured();
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const resetCaptcha = () => {
    setCaptchaToken(null);
    setCaptchaKey((k) => k + 1);
  };

  // Pesan error dari halaman callback Google (?error=...).
  // Dibaca dari window.location (bukan useSearchParams) supaya halaman
  // tetap bisa di-prerender statis tanpa memerlukan Suspense boundary.
  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get("error");
    if (err) setError(err);
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
    return <PageLoader title={a.pageLoader} />;
  }

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

  const goAfterLogin = async () => {
    const needOnboarding = await needsOnboarding().catch(() => false);
    router.replace(needOnboarding ? "/onboarding" : getSafeNext());
  };

  const handleGoogle = async () => {
    if (googleBusy) return;
    setError(null);
    setGoogleBusy(true);
    try {
      await signInWithGoogle(undefined, getSafeNext());
      // Browser sedang dialihkan ke Google; jika kembali, reset state.
      setGoogleBusy(false);
    } catch (e) {
      setGoogleBusy(false);
      setError(e instanceof Error ? e.message : a.errGoogle);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!email.trim() || !password) {
      setError(a.errFill);
      return;
    }
    if (captchaConfigured && !captchaToken) {
      setError(a.errCaptcha);
      return;
    }

    setSubmitting(true);
    resetCaptcha(); // token sekali pakai — siapkan yang baru untuk percobaan berikutnya
    const result = await loginUser({ email, password, captchaToken: captchaToken ?? undefined });
    if (!result.ok) {
      setError(result.error ?? a.errLogin);
      setSubmitting(false);
      return;
    }

    await goAfterLogin();
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpSending || cooldown > 0) return;
    setError(null);

    if (!email.trim()) {
      setError(a.errEmail);
      return;
    }
    if (captchaConfigured && !captchaToken) {
      setError(a.errCaptcha);
      return;
    }

    setOtpSending(true);
    resetCaptcha(); // token sekali pakai — siapkan yang baru untuk percobaan berikutnya
    const result = await requestOtpLogin(email, undefined, captchaToken ?? undefined);
    setOtpSending(false);
    if (!result.ok) {
      setError(result.error ?? a.errSend);
      return;
    }

    setOtpSent(true);
    setOtpCode("");
    startCooldown();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
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
    const result = await verifyOtpLogin(email, otpCode, undefined, captchaToken ?? undefined);
    if (!result.ok) {
      setError(result.error ?? a.errVerify);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    await goAfterLogin();
  };

  const backToEmail = () => {
    setOtpSent(false);
    setOtpCode("");
    setError(null);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-clay-beige px-4 py-10">
      <div className="w-full max-w-[440px]">
        <Link href="/" className="mb-8 flex items-center justify-center gap-3">
          <img src="/logo.png" alt="Logo Eureka.AI" className="h-11 w-11 object-contain" />
          <span className="text-2xl font-extrabold text-clay-dark">
            Eureka<span className="text-clay-primary">.AI</span>
          </span>
        </Link>

        <CardClay className="!p-8 sm:!p-10">
          <h1 className="text-center text-2xl font-extrabold text-clay-dark sm:text-3xl">
            {a.welcome}
            <Hand size={26} className="ml-2 inline text-clay-primary" />
          </h1>
          <p className="mt-2 text-center text-base font-semibold text-clay-muted">
            {a.welcomeSub}
          </p>

          {/* Login dengan Google */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleBusy}
            className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-clay-md border-2 border-clay-shadow/40 bg-white px-4 py-3.5 text-sm font-extrabold text-clay-dark transition-all duration-75 hover:-translate-y-0.5 hover:shadow-clay-sm active:translate-y-0.5 disabled:opacity-60"
          >
            {googleBusy ? (
              <Loader2 size={18} className="animate-spin text-clay-muted" />
            ) : (
              <GoogleIcon size={18} />
            )}
            {a.loginGoogle}
          </button>

          <div className="mt-5 flex items-center gap-3">
            <span className="h-0.5 flex-1 rounded-full bg-clay-shadow/40" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-clay-muted">
              {a.or}
            </span>
            <span className="h-0.5 flex-1 rounded-full bg-clay-shadow/40" />
          </div>

          {/* Pilih metode login */}
          <div className="mt-6 flex gap-2 rounded-clay-full border-3 border-clay-shadow/40 bg-clay-inputBg p-1 shadow-clay-inset">
            {(
              [
                { id: "password", label: a.tabPassword },
                { id: "otp", label: a.tabOtp },
              ] as { id: LoginMode; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setMode(tab.id);
                  setError(null);
                }}
                className={`min-h-[44px] flex-1 rounded-clay-full border-2 text-sm font-extrabold transition-all duration-75 ${
                  mode === tab.id
                    ? "border-clay-primary bg-clay-primary text-white shadow-clay-sm"
                    : "border-transparent text-clay-muted hover:text-clay-dark"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {mode === "password" ? (
            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-extrabold text-clay-dark">
                  {a.email}
                </label>
                <div className="relative">
                  <Mail
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-clay-muted"
                  />
                  <InputClay
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder={a.emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="!pl-11"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-extrabold text-clay-dark">
                  {a.password}
                </label>
                <div className="relative">
                  <Lock
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-clay-muted"
                  />
                  <InputClay
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="!pl-11 !pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? a.hidePassword : a.showPassword}
                    className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-clay-muted transition-colors hover:text-clay-primary"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="rounded-clay-md border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                  {error}
                </p>
              )}

              <div className="flex justify-center">
                <TurnstileCaptcha
                  key={`pw-${captchaKey}`}
                  onToken={setCaptchaToken}
                />
              </div>

              <ButtonClay
                type="submit"
                fullWidth
                disabled={submitting || (captchaConfigured && !captchaToken)}
                className="!min-h-[56px]"
              >
                {submitting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <LogIn size={18} className="mr-2" />
                    {a.login}
                  </>
                )}
              </ButtonClay>
            </form>
          ) : !otpSent ? (
            <form onSubmit={handleSendOtp} className="mt-6 space-y-5">
              <p className="rounded-2xl border-2 border-dashed border-clay-shadow/40 p-3 text-center text-sm font-semibold text-clay-muted">
                {a.otpHint}
              </p>
              <div>
                <label className="mb-2 block text-sm font-extrabold text-clay-dark">
                  {a.email}
                </label>
                <div className="relative">
                  <Mail
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-clay-muted"
                  />
                  <InputClay
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder={a.emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="!pl-11"
                    required
                  />
                </div>
              </div>

              {error && (
                <p className="rounded-clay-md border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                  {error}
                </p>
              )}

              <div className="flex justify-center">
                <TurnstileCaptcha
                  key={`otp-${captchaKey}`}
                  onToken={setCaptchaToken}
                />
              </div>

              <ButtonClay
                type="submit"
                fullWidth
                disabled={otpSending || (captchaConfigured && !captchaToken)}
                className="!min-h-[56px]"
              >
                {otpSending ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <KeyRound size={18} className="mr-2" />
                    {a.sendCode}
                  </>
                )}
              </ButtonClay>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="mt-6 space-y-5">
              <button
                type="button"
                onClick={backToEmail}
                className="flex items-center gap-1 text-xs font-extrabold text-clay-muted transition-colors hover:text-clay-primary"
              >
                <ArrowLeft size={13} />
                {a.changeEmail}
              </button>
              <p className="rounded-2xl border-2 border-dashed border-clay-shadow/40 p-3 text-center text-sm font-semibold text-clay-muted">
                {a.otpSent}{" "}
                <b className="text-clay-dark">{email.trim().toLowerCase()}</b>.
                {a.otpCheckInbox}
              </p>
              <div>
                <label className="mb-2 block text-sm font-extrabold text-clay-dark">
                  {a.otpLabel}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoFocus
                  placeholder="••••••"
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="input-clay text-center !text-2xl !font-extrabold tracking-[0.4em]"
                />
              </div>

              {error && (
                <p className="rounded-clay-md border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                  {error}
                </p>
              )}

              <div className="flex justify-center">
                <TurnstileCaptcha
                  key={`otpv-${captchaKey}`}
                  onToken={setCaptchaToken}
                />
              </div>

              <ButtonClay
                type="submit"
                fullWidth
                disabled={
                  submitting || otpCode.length !== 6 || (captchaConfigured && !captchaToken)
                }
                className="!min-h-[56px]"
              >
                {submitting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <LogIn size={18} className="mr-2" />
                    {a.login}
                  </>
                )}
              </ButtonClay>

              <button
                type="button"
                onClick={handleSendOtp}
                disabled={otpSending || cooldown > 0}
                className="w-full text-center text-xs font-extrabold text-clay-muted transition-colors hover:text-clay-primary disabled:opacity-50"
              >
                {otpSending
                  ? a.resending
                  : cooldown > 0
                    ? `${a.resendIn} ${cooldown}s`
                    : a.resend}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm font-bold text-clay-muted">
            {a.noAccount}{" "}
            <Link href="/register" className="font-extrabold text-clay-primary underline-offset-2 hover:underline">
              {dict.nav.cobaGratis}
            </Link>
          </p>
          <p className="mt-3 text-center text-xs font-semibold text-clay-muted">
            <Link href="/" className="text-clay-muted underline-offset-2 hover:underline">
              {a.backHome}
            </Link>
          </p>
        </CardClay>
      </div>
    </div>
  );
}
