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
  User,
} from "lucide-react";

import { confirmSakugaButton, SakugaButton, type SakugaButtonElement } from "@/components/ui/sakuga";
import AuthShell from "@/components/auth/AuthShell";
import InputClay from "@/components/ui/InputClay";
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
  const submitButton = useRef<SakugaButtonElement>(null);

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
    if (!result.ok) {
      setSending(false);
      setError(result.error ?? a.errSend);
      return;
    }

    if (step === "form") await confirmSakugaButton(submitButton.current);
    setSending(false);
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
    await Promise.all([registerFriendsIdentity(result.user!.name), confirmSakugaButton(submitButton.current)]);

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
    <AuthShell mode="register">
      <div className="auth-form">
          <h1 className="flex items-center justify-center gap-2 text-center text-2xl font-extrabold text-clay-dark sm:text-3xl">
            {a.regTitle}
          </h1>
          <p className="mt-2 text-center text-base font-semibold text-clay-muted">
            {step === "form" ? a.regSubForm : a.regSubOtp}
          </p>

          {step === "form" ? (
            <>
              {/* Daftar dengan Google */}
              <SakugaButton
                variant="secondary"
                onClick={handleGoogle}
                disabled={googleBusy}
                className="mt-8 w-full"
              >
                {googleBusy ? (
                  <Loader2 size={18} className="animate-spin text-clay-muted" />
                ) : (
                  <GoogleIcon size={18} />
                )}
                {a.regGoogle}
              </SakugaButton>

              <div className="mt-5 flex items-center gap-3">
                <span className="h-0.5 flex-1 rounded-full bg-clay-shadow/40" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-clay-muted">
                  {a.or}
                </span>
                <span className="h-0.5 flex-1 rounded-full bg-clay-shadow/40" />
              </div>

              <form onSubmit={handleSendOtp} className="mt-5 space-y-5">
              <div>
                <label htmlFor="auth-name" className="mb-2 block text-sm font-extrabold text-clay-dark">
                  {a.fullName}
                </label>
                <div className="relative">
                  <User
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-clay-muted"
                  />
                  <InputClay
                    id="auth-name"
                    type="text"
                    autoComplete="name"
                    placeholder={a.namePlaceholder}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="!pl-11"
                    required
                  />
                </div>
              </div>

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
                  key={`reg-${captchaKey}`}
                  onToken={setCaptchaToken}
                />
              </div>}

              <SakugaButton
                type="submit"
                variant="primary"
                buttonRef={submitButton}
                disabled={sending || !canSend}
                className="w-full"
              >
                {sending ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <KeyRound size={18} className="mr-2" />
                    {a.regOtp}
                  </>
                )}
              </SakugaButton>
              </form>
            </>
          ) : (
            <form onSubmit={handleVerify} className="mt-6 space-y-5">
              <SakugaButton
                variant="secondary"
                onClick={backToForm}
                disabled={submitting}
              >
                <ArrowLeft size={13} />
                {a.changeNameEmail}
              </SakugaButton>
              <p className="rounded-2xl border-2 border-dashed border-clay-shadow/40 p-3 text-center text-sm font-semibold text-clay-muted">
                {a.otpSent}{" "}
                <b className="text-clay-dark">{email.trim().toLowerCase()}</b>.
                {a.regOtpSent}
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
                  key={`regv-${captchaKey}`}
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
                    <ArrowRight size={18} className="mr-2" />
                    {a.createAccount}
                  </>
                )}
              </SakugaButton>

              <button
                type="button"
                onClick={handleSendOtp}
                disabled={sending || cooldown > 0}
                className="w-full text-center text-xs font-extrabold text-clay-muted transition-colors hover:text-clay-primary disabled:opacity-50"
              >
                {sending
                  ? a.resending
                  : cooldown > 0
                    ? `${a.resendIn} ${cooldown}s`
                    : a.resend}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm font-bold text-clay-muted">
            {a.haveAccount}{" "}
            <Link href="/login" className="font-extrabold text-clay-primary underline-offset-2 hover:underline">
              {a.loginHere}
            </Link>
          </p>
      </div>
    </AuthShell>
  );
}
