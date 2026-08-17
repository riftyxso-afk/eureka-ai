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

import ButtonClay from "@/components/ui/ButtonClay";
import CardClay from "@/components/ui/CardClay";
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-clay-beige px-4 py-10">
      <div className="w-full max-w-[440px]">
        <Link href="/" className="mb-8 flex items-center justify-center gap-3">
          <img src="/logo.png" alt="Logo Eureka.AI" className="h-11 w-11 object-contain" />
          <span className="text-2xl font-extrabold text-clay-dark">
            Eureka<span className="text-clay-primary">.AI</span>
          </span>
        </Link>

        <CardClay className="!p-8 sm:!p-10">
          <h1 className="flex items-center justify-center gap-2 text-center text-2xl font-extrabold text-clay-dark sm:text-3xl">
            {a.regTitle}
            <Rocket size={26} className="shrink-0 text-clay-secondary" />
          </h1>
          <p className="mt-2 text-center text-base font-semibold text-clay-muted">
            {step === "form" ? a.regSubForm : a.regSubOtp}
          </p>

          {step === "form" ? (
            <>
              {/* Daftar dengan Google */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={googleBusy}
                className="mt-8 flex w-full items-center justify-center gap-2.5 rounded-clay-md border-2 border-clay-shadow/40 bg-white px-4 py-3.5 text-sm font-extrabold text-clay-dark transition-all duration-75 hover:-translate-y-0.5 hover:shadow-clay-sm active:translate-y-0.5 disabled:opacity-60"
              >
                {googleBusy ? (
                  <Loader2 size={18} className="animate-spin text-clay-muted" />
                ) : (
                  <GoogleIcon size={18} />
                )}
                {a.regGoogle}
              </button>

              <div className="mt-5 flex items-center gap-3">
                <span className="h-0.5 flex-1 rounded-full bg-clay-shadow/40" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-clay-muted">
                  {a.or}
                </span>
                <span className="h-0.5 flex-1 rounded-full bg-clay-shadow/40" />
              </div>

              <form onSubmit={handleSendOtp} className="mt-5 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-extrabold text-clay-dark">
                  {a.fullName}
                </label>
                <div className="relative">
                  <User
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-clay-muted"
                  />
                  <InputClay
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
                  key={`reg-${captchaKey}`}
                  onToken={setCaptchaToken}
                />
              </div>

              <ButtonClay
                type="submit"
                fullWidth
                disabled={sending || !canSend}
                className="!min-h-[56px]"
              >
                {sending ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <KeyRound size={18} className="mr-2" />
                    {a.regOtp}
                  </>
                )}
              </ButtonClay>
              </form>
            </>
          ) : (
            <form onSubmit={handleVerify} className="mt-6 space-y-5">
              <button
                type="button"
                onClick={backToForm}
                className="flex items-center gap-1 text-xs font-extrabold text-clay-muted transition-colors hover:text-clay-primary"
              >
                <ArrowLeft size={13} />
                {a.changeNameEmail}
              </button>
              <p className="rounded-2xl border-2 border-dashed border-clay-shadow/40 p-3 text-center text-sm font-semibold text-clay-muted">
                {a.otpSent}{" "}
                <b className="text-clay-dark">{email.trim().toLowerCase()}</b>.
                {a.regOtpSent}
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
                  key={`regv-${captchaKey}`}
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
                    <ArrowRight size={18} className="mr-2" />
                    {a.createAccount}
                  </>
                )}
              </ButtonClay>

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