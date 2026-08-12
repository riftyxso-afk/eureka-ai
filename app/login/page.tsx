"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogIn,
  Mail,
  Lock,
  ArrowLeft,
} from "lucide-react";

import ButtonClay from "@/components/ui/ButtonClay";
import CardClay from "@/components/ui/CardClay";
import InputClay from "@/components/ui/InputClay";
import GoogleIcon from "@/components/ui/GoogleIcon";
import {
  isLoggedIn,
  loginUser,
  needsOnboarding,
  requestOtpLogin,
  signInWithGoogle,
  verifyOtpLogin,
} from "@/lib/auth";

type LoginMode = "password" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  // Pesan error dari halaman callback Google (?error=...) — useSearchParams
  // sudah men-decode nilai URL, jadi langsung dipakai apa adanya.
  useEffect(() => {
    const err = searchParams.get("error");
    if (err) setError(err);
  }, [searchParams]);

  useEffect(() => {
    if (isLoggedIn()) {
      (async () => {
        const needOnboarding = await needsOnboarding().catch(() => false);
        router.replace(needOnboarding ? "/onboarding" : "/dashboard");
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-clay-beige">
        <Loader2 size={32} className="animate-spin text-clay-primary" />
      </div>
    );
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
    router.replace(needOnboarding ? "/onboarding" : "/dashboard");
  };

  const handleGoogle = async () => {
    if (googleBusy) return;
    setError(null);
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
      // Browser sedang dialihkan ke Google; jika kembali, reset state.
      setGoogleBusy(false);
    } catch (e) {
      setGoogleBusy(false);
      setError(
        e instanceof Error ? e.message : "Gagal membuka login Google."
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!email.trim() || !password) {
      setError("Isi email dan kata sandi dulu ya.");
      return;
    }

    setSubmitting(true);
    const result = await loginUser({ email, password });
    if (!result.ok) {
      setError(result.error ?? "Gagal masuk. Coba lagi.");
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
      setError("Masukkan email dulu ya.");
      return;
    }

    setOtpSending(true);
    const result = await requestOtpLogin(email);
    setOtpSending(false);
    if (!result.ok) {
      setError(result.error ?? "Gagal mengirim kode. Coba lagi.");
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
      setError("Masukkan kode 6 digit dari email.");
      return;
    }

    setSubmitting(true);
    const result = await verifyOtpLogin(email, otpCode);
    if (!result.ok) {
      setError(result.error ?? "Gagal verifikasi. Coba lagi.");
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
            Selamat Datang Kembali! 👋
          </h1>
          <p className="mt-2 text-center text-base font-semibold text-clay-muted">
            Masuk dan lanjutkan momen Eureka-mu
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
            Masuk dengan Google
          </button>

          <div className="mt-5 flex items-center gap-3">
            <span className="h-0.5 flex-1 rounded-full bg-clay-shadow/40" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-clay-muted">
              atau
            </span>
            <span className="h-0.5 flex-1 rounded-full bg-clay-shadow/40" />
          </div>

          {/* Pilih metode login */}
          <div className="mt-6 flex gap-2 rounded-clay-full border-3 border-clay-shadow/40 bg-clay-inputBg p-1 shadow-clay-inset">
            {(
              [
                { id: "password", label: "Kata Sandi" },
                { id: "otp", label: "Kode OTP" },
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
                  EMAIL
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
                    placeholder="kamu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="!pl-11"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-extrabold text-clay-dark">
                  KATA SANDI
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
                    aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
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

              <ButtonClay type="submit" fullWidth disabled={submitting} className="!min-h-[56px]">
                {submitting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <LogIn size={18} className="mr-2" />
                    Masuk
                  </>
                )}
              </ButtonClay>
            </form>
          ) : !otpSent ? (
            <form onSubmit={handleSendOtp} className="mt-6 space-y-5">
              <p className="rounded-2xl border-2 border-dashed border-clay-shadow/40 p-3 text-center text-sm font-semibold text-clay-muted">
                Masukkan email — kami kirim kode 6 digit yang berlaku beberapa
                menit. Tidak perlu kata sandi! 🔑
              </p>
              <div>
                <label className="mb-2 block text-sm font-extrabold text-clay-dark">
                  EMAIL
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
                    placeholder="kamu@email.com"
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

              <ButtonClay
                type="submit"
                fullWidth
                disabled={otpSending}
                className="!min-h-[56px]"
              >
                {otpSending ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <KeyRound size={18} className="mr-2" />
                    Kirim Kode
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
                Ganti email
              </button>
              <p className="rounded-2xl border-2 border-dashed border-clay-shadow/40 p-3 text-center text-sm font-semibold text-clay-muted">
                Kode 6 digit terkirim ke{" "}
                <b className="text-clay-dark">{email.trim().toLowerCase()}</b>.
                Periksa kotak masuk (atau spam) email kamu.
              </p>
              <div>
                <label className="mb-2 block text-sm font-extrabold text-clay-dark">
                  KODE OTP
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

              <ButtonClay
                type="submit"
                fullWidth
                disabled={submitting || otpCode.length !== 6}
                className="!min-h-[56px]"
              >
                {submitting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <LogIn size={18} className="mr-2" />
                    Masuk
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
                  ? "Mengirim ulang..."
                  : cooldown > 0
                    ? `Kirim ulang dalam ${cooldown}s`
                    : "Kirim ulang kode"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm font-bold text-clay-muted">
            Belum punya akun?{" "}
            <Link href="/register" className="font-extrabold text-clay-primary underline-offset-2 hover:underline">
              Daftar Gratis
            </Link>
          </p>
          <p className="mt-3 text-center text-xs font-semibold text-clay-muted">
            <Link href="/" className="text-clay-muted underline-offset-2 hover:underline">
              ← Kembali ke beranda
            </Link>
          </p>
        </CardClay>
      </div>
    </div>
  );
}
