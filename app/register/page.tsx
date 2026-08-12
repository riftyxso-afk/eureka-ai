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
import AvatarClay from "@/components/ui/AvatarClay";
import ButtonClay from "@/components/ui/ButtonClay";
import CardClay from "@/components/ui/CardClay";
import InputClay from "@/components/ui/InputClay";
import { getUserId } from "@/lib/identity";
import {
  isLoggedIn,
  needsOnboarding,
  requestOtpLogin,
  verifyOtpLogin,
} from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "otp">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const canSend = name.trim().length >= 2 && email.trim().length > 0;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || cooldown > 0) return;
    setError(null);

    if (!canSend) {
      setError("Isi nama (minimal 2 huruf) dan email dulu ya.");
      return;
    }

    setSending(true);
    const result = await requestOtpLogin(email, name);
    setSending(false);
    if (!result.ok) {
      setError(result.error ?? "Gagal mengirim kode. Coba lagi.");
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
      setError("Masukkan kode 6 digit dari email.");
      return;
    }

    setSubmitting(true);
    const result = await verifyOtpLogin(email, otpCode, name);
    if (!result.ok) {
      setError(result.error ?? "Gagal verifikasi. Coba lagi.");
      setSubmitting(false);
      return;
    }

    // Sinkronkan identitas ke backend teman/kolaborasi.
    try {
      await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          userId: getUserId(),
          name: result.user!.name,
        }),
      });
    } catch {
      // abaikan
    }

    router.replace("/onboarding");
  };

  const backToForm = () => {
    setStep("form");
    setOtpCode("");
    setError(null);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-clay-beige px-4 py-10">
      <div className="w-full max-w-[440px]">
        <Link href="/" className="mb-8 flex items-center justify-center gap-3">
          <AvatarClay name="Eureka" size={44} />
          <span className="text-2xl font-extrabold text-clay-dark">
            Eureka<span className="text-clay-primary">.AI</span>
          </span>
        </Link>

        <CardClay className="!p-8 sm:!p-10">
          <h1 className="text-center text-2xl font-extrabold text-clay-dark sm:text-3xl">
            Daftar Gratis Sekarang 🚀
          </h1>
          <p className="mt-2 text-center text-base font-semibold text-clay-muted">
            {step === "form"
              ? "Isi nama & email — akun dibuat otomatis setelah kode OTP kamu verifikasi"
              : "Cek emailmu untuk kode verifikasi"}
          </p>

          {step === "form" ? (
            <form onSubmit={handleSendOtp} className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-extrabold text-clay-dark">
                  NAMA LENGKAP
                </label>
                <div className="relative">
                  <User
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-clay-muted"
                  />
                  <InputClay
                    type="text"
                    autoComplete="name"
                    placeholder="Nama kamu"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="!pl-11"
                    required
                  />
                </div>
              </div>

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
                disabled={sending || !canSend}
                className="!min-h-[56px]"
              >
                {sending ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <KeyRound size={18} className="mr-2" />
                    Daftar dengan Kode OTP
                  </>
                )}
              </ButtonClay>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="mt-6 space-y-5">
              <button
                type="button"
                onClick={backToForm}
                className="flex items-center gap-1 text-xs font-extrabold text-clay-muted transition-colors hover:text-clay-primary"
              >
                <ArrowLeft size={13} />
                Ubah nama / email
              </button>
              <p className="rounded-2xl border-2 border-dashed border-clay-shadow/40 p-3 text-center text-sm font-semibold text-clay-muted">
                Kode 6 digit terkirim ke{" "}
                <b className="text-clay-dark">{email.trim().toLowerCase()}</b>.
                Periksa kotak masuk (atau spam) email kamu. Akun dibuat otomatis
                saat kode benar.
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
                    <ArrowRight size={18} className="mr-2" />
                    Buat Akun & Masuk
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
                  ? "Mengirim ulang..."
                  : cooldown > 0
                    ? `Kirim ulang dalam ${cooldown}s`
                    : "Kirim ulang kode"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm font-bold text-clay-muted">
            Sudah punya akun?{" "}
            <Link href="/login" className="font-extrabold text-clay-primary underline-offset-2 hover:underline">
              Masuk di sini
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