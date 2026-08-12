"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, Rocket, User } from "lucide-react";
import AvatarClay from "@/components/ui/AvatarClay";
import ButtonClay from "@/components/ui/ButtonClay";
import CardClay from "@/components/ui/CardClay";
import InputClay from "@/components/ui/InputClay";
import { getUserId } from "@/lib/identity";
import { isLoggedIn, needsOnboarding, registerUser } from "@/lib/auth";

const REQUIREMENTS = [
  { min: 2, label: "Nama minimal 2 huruf" },
  { min: 6, label: "Kata sandi minimal 6 karakter" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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

    if (password !== confirm) {
      setError("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setSubmitting(true);
    const result = await registerUser({ name, email, password });
    if (!result.ok) {
      setError(result.error ?? "Gagal mendaftar. Coba lagi.");
      setSubmitting(false);
      return;
    }

    if (result.needsConfirmation) {
      setError(
        "Akun dibuat! Silakan cek email kamu untuk verifikasi, lalu masuk."
      );
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

  const canSubmit =
    name.trim().length >= 2 &&
    email.trim().length > 0 &&
    password.length >= 6 &&
    confirm.length > 0;

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
            Mulai Gratis Sekarang 🚀
          </h1>
          <p className="mt-2 text-center text-base font-semibold text-clay-muted">
            Satu langkah lagi menuju momen Eureka pertamamu
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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
                  autoComplete="new-password"
                  placeholder="Minimal 6 karakter"
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

            <div>
              <label className="mb-2 block text-sm font-extrabold text-clay-dark">
                ULANGI KATA SANDI
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-clay-muted"
                />
                <InputClay
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Ketik ulang kata sandi"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="!pl-11"
                  required
                />
              </div>
            </div>

            <ul className="space-y-1.5">
              {REQUIREMENTS.map((r) => {
                const ok = r.min === 2 ? name.trim().length >= 2 : password.length >= 6;
                return (
                  <li
                    key={r.label}
                    className={`flex items-center gap-2 text-xs font-bold ${
                      ok ? "text-clay-success" : "text-clay-muted"
                    }`}
                  >
                    <CheckCircle2 size={14} className={ok ? "" : "opacity-40"} />
                    {r.label}
                  </li>
                );
              })}
              {password && confirm && password !== confirm && (
                <li className="flex items-center gap-2 text-xs font-bold text-red-500">
                  <CheckCircle2 size={14} className="opacity-40" />
                  Konfirmasi kata sandi belum cocok
                </li>
              )}
            </ul>

            {error && (
              <p className="rounded-clay-md border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                {error}
              </p>
            )}

            <ButtonClay
              type="submit"
              fullWidth
              disabled={submitting || !canSubmit}
              className="!min-h-[56px]"
            >
              {submitting ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <CheckCircle2 size={18} className="mr-2" />
                  Daftar Gratis
                </>
              )}
            </ButtonClay>
          </form>

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
