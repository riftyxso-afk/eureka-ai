"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import "feral-blob/blob.css";

const FormBlob = dynamic(() => import("feral-blob").then((mod) => mod.JellyBlobMascot), { ssr: false });
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Mail,
} from "lucide-react";

import { confirmSakugaButton, SakugaButton, SakugaRadio, type SakugaButtonElement } from "@/components/ui/sakuga";
import AuthShell from "@/components/auth/AuthShell";
import ImportAccount from "@/components/auth/ImportAccount";
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
  const { dict, locale } = useI18n();
  const a = dict.auth;
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("");
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(null);
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
  const submitButton = useRef<SakugaButtonElement>(null);
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

    await confirmSakugaButton(submitButton.current);
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
    if (!result.ok) {
      setOtpSending(false);
      setError(result.error ?? a.errSend);
      return;
    }

    if (!otpSent) await confirmSakugaButton(submitButton.current);
    setOtpSending(false);
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

    await confirmSakugaButton(submitButton.current);
    await goAfterLogin();
  };

  const backToEmail = () => {
    setOtpSent(false);
    setOtpCode("");
    setError(null);
  };

  return (
    <AuthShell mode="login">
      <div className="auth-form" onFocusCapture={(event) => {
        const target = event.target as HTMLElement;
        setFocusedField(target.id === "auth-email" ? "email" : target.id === "auth-password" || target.dataset.passwordToggle === "true" ? "password" : null);
      }} onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusedField(null);
      }}>
          <div className={`auth-companion ${focusedField ? `is-${focusedField}` : ""}`} aria-hidden="true">
            <FormBlob stillBody mood={focusedField === "password" ? "password" : focusedField === "email" ? "curious" : "neutral"} gaze={{ x: focusedField === "email" ? Math.min(24, email.length * 1.5 - 12) : 0, y: focusedField === "email" ? 12 : 0 }} />
          </div>
          <h1 className="text-center text-2xl font-extrabold text-clay-dark sm:text-3xl">
            {a.welcome}
          </h1>
          <p className="mt-2 text-center text-base font-semibold text-clay-muted">
            {a.welcomeSub}
          </p>

          {/* Login dengan Google */}
          <SakugaButton
            variant="secondary"
            onClick={handleGoogle}
            disabled={googleBusy}
            className="mt-6 w-full"
          >
            {googleBusy ? (
              <Loader2 size={18} className="animate-spin text-clay-muted" />
            ) : (
              <GoogleIcon size={18} />
            )}
            {a.loginGoogle}
          </SakugaButton>

          <div className="mt-5 flex items-center gap-3">
            <span className="h-0.5 flex-1 rounded-full bg-clay-shadow/40" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-clay-muted">
              {a.or}
            </span>
            <span className="h-0.5 flex-1 rounded-full bg-clay-shadow/40" />
          </div>

          <ImportAccount />
          <div className="sakuga-radio-row mt-6 text-sm font-bold">
            <SakugaRadio label={locale === "en" ? "Sign-in method" : "Metode masuk"} name="login-method" value={mode}
              options={[{ id: "password", label: a.tabPassword }, { id: "otp", label: a.tabOtp }]}
              onChange={value => { setMode(value === "otp" ? "otp" : "password"); setError(null); }} />
          </div>

          {mode === "password" ? (
            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label htmlFor="auth-email" className="mb-2 block text-sm font-extrabold text-clay-dark">
                  {a.email}
                </label>
                <div className="relative">
                  <Mail
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-clay-muted"
                  />
                  <InputClay
                    id="auth-email"
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
                <label htmlFor="auth-password" className="mb-2 block text-sm font-extrabold text-clay-dark">
                  {a.password}
                </label>
                <div className="relative">
                  <Lock
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-clay-muted"
                  />
                  <InputClay
                    id="auth-password"
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
                    data-password-toggle="true"
                    aria-label={showPassword ? a.hidePassword : a.showPassword}
                    className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-clay-muted transition-colors hover:text-clay-primary"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="rounded-clay-md border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                  {error}
                </p>
              )}

              {captchaConfigured && <div className="flex justify-center">
                <TurnstileCaptcha
                  key={`pw-${captchaKey}`}
                  onToken={setCaptchaToken}
                />
              </div>}

              <SakugaButton
                type="submit"
                variant="primary"
                buttonRef={submitButton}
                disabled={submitting || (captchaConfigured && !captchaToken)}
                className="w-full"
              >
                {submitting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <LogIn size={18} className="mr-2" />
                    {a.login}
                  </>
                )}
              </SakugaButton>
            </form>
          ) : !otpSent ? (
            <form onSubmit={handleSendOtp} className="mt-6 space-y-5">
              <p className="rounded-2xl border-2 border-dashed border-clay-shadow/40 p-3 text-center text-sm font-semibold text-clay-muted">
                {a.otpHint}
              </p>
              <div>
                <label htmlFor="auth-email" className="mb-2 block text-sm font-extrabold text-clay-dark">
                  {a.email}
                </label>
                <div className="relative">
                  <Mail
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-clay-muted"
                  />
                  <InputClay
                    id="auth-email"
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
                <p role="alert" className="rounded-clay-md border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                  {error}
                </p>
              )}

              {captchaConfigured && <div className="flex justify-center">
                <TurnstileCaptcha
                  key={`otp-${captchaKey}`}
                  onToken={setCaptchaToken}
                />
              </div>}

              <SakugaButton
                type="submit"
                variant="primary"
                buttonRef={submitButton}
                disabled={otpSending || (captchaConfigured && !captchaToken)}
                className="w-full"
              >
                {otpSending ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <KeyRound size={18} className="mr-2" />
                    {a.sendCode}
                  </>
                )}
              </SakugaButton>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="mt-6 space-y-5">
              <SakugaButton
                variant="secondary"
                onClick={backToEmail}
                disabled={submitting}
              >
                <ArrowLeft size={13} />
                {a.changeEmail}
              </SakugaButton>
              <p className="rounded-2xl border-2 border-dashed border-clay-shadow/40 p-3 text-center text-sm font-semibold text-clay-muted">
                {a.otpSent}{" "}
                <b className="text-clay-dark">{email.trim().toLowerCase()}</b>.
                {a.otpCheckInbox}
              </p>
              <div>
                <label htmlFor="auth-otp" className="mb-2 block text-sm font-extrabold text-clay-dark">
                  {a.otpLabel}
                </label>
                <input
                  id="auth-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
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
                <p role="alert" className="rounded-clay-md border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                  {error}
                </p>
              )}

              {captchaConfigured && <div className="flex justify-center">
                <TurnstileCaptcha
                  key={`otpv-${captchaKey}`}
                  onToken={setCaptchaToken}
                />
              </div>}

              <SakugaButton
                type="submit"
                variant="primary"
                buttonRef={submitButton}
                disabled={
                  submitting || otpCode.length !== 6 || (captchaConfigured && !captchaToken)
                }
                className="w-full"
              >
                {submitting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <LogIn size={18} className="mr-2" />
                    {a.login}
                  </>
                )}
              </SakugaButton>

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

          {process.env.NODE_ENV === "development" && (
            <p className="mt-5 text-center text-sm font-bold">
              <Link href="/dashboard" className="text-clay-primary underline-offset-2 hover:underline">
                Buka dashboard untuk pratinjau lokal →
              </Link>
            </p>
          )}

          <p className="mt-6 text-center text-sm font-bold text-clay-muted">
            {a.noAccount}{" "}
            <Link href="/register" className="font-extrabold text-clay-primary underline-offset-2 hover:underline">
              {dict.nav.cobaGratis}
            </Link>
          </p>
      </div>
    </AuthShell>
  );
}
