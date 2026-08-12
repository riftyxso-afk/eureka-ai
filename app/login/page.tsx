"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, LogIn, Mail, Lock } from "lucide-react";
import AvatarClay from "@/components/ui/AvatarClay";
import ButtonClay from "@/components/ui/ButtonClay";
import CardClay from "@/components/ui/CardClay";
import InputClay from "@/components/ui/InputClay";
import { isLoggedIn, loginUser, needsOnboarding } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checked, setChecked] = useState(false);

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

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-clay-beige">
        <Loader2 size={32} className="animate-spin text-clay-primary" />
      </div>
    );
  }

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

    const needOnboarding = await needsOnboarding().catch(() => false);
    router.replace(needOnboarding ? "/onboarding" : "/dashboard");
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
          <h1 className="text-center text-3xl font-extrabold text-clay-dark">
            Selamat Datang Kembali! 👋
          </h1>
          <p className="mt-2 text-center text-base font-semibold text-clay-muted">
            Masuk dan lanjutkan momen Eureka-mu
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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
