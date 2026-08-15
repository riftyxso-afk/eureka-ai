"use client";

import { useState } from "react";
import Link from "next/link";
import { Mic, PhoneCall, Loader2, CheckCircle2, Sparkles, LogIn } from "lucide-react";
import CardClay from "@/components/ui/CardClay";
import ButtonClay from "@/components/ui/ButtonClay";
import { useBeta } from "@/lib/useBeta";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { isLoggedIn, syncAuthSession } from "@/lib/auth";

const BETA_FEATURES = [
  {
    icon: Mic,
    title: "Rekam Suara di Composer",
    desc: "Bicara, langsung jadi teks di kolom chat — tanpa ngetik.",
  },
  {
    icon: PhoneCall,
    title: "Panggilan AI Realtime",
    desc: "Tutor suara Eureka.AI: tanya dengan suara, dijawab dengan suara + visualizer animasi.",
  },
  {
    icon: Sparkles,
    title: "Akses Awal Fitur Baru",
    desc: "Kamu termasuk yang pertama mencoba fitur eksperimental sebelum rilis publik.",
  },
];

export default function JoinBetaPage() {
  const { isBeta, loading, refresh } = useBeta();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justJoined, setJustJoined] = useState(false);

  const handleJoin = async () => {
    setError(null);
    setBusy(true);
    try {
      await syncAuthSession().catch(() => undefined);
      if (!isLoggedIn()) {
        window.location.href = "/login?next=/join";
        return;
      }
      const userId = getUserId();
      if (!userId) {
        setError("Silakan masuk dulu untuk join beta.");
        return;
      }
      const res = await apiFetch("/api/beta/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "Gagal join beta. Coba lagi ya 🙏");
        return;
      }
      setJustJoined(true);
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Gagal join beta. Coba lagi ya 🙏"
      );
    } finally {
      setBusy(false);
    }
  };

  const alreadyBeta = isBeta || justJoined;

  return (
    <main className="min-h-screen bg-clay-beige px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-clay-full bg-clay-primary/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-clay-primary">
            <Sparkles size={12} /> Program Beta Tester
          </span>
          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">
            Gabung Beta Eureka.AI 🚀
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm font-semibold text-clay-muted sm:text-base">
            Bantu kami menguji fitur baru &amp; dapatkan akses lebih awal. Sebagai
            beta tester, kamu bisa langsung mencoba fitur eksperimental:
          </p>
        </div>

        <div className="space-y-3 sm:space-y-4">
          {BETA_FEATURES.map((f) => (
            <CardClay key={f.title} className="p-4 sm:p-5">
              <div className="flex items-start gap-3 sm:gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-clay-primary/10 text-clay-primary">
                  <f.icon size={20} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-extrabold sm:text-lg">{f.title}</h2>
                  <p className="mt-0.5 text-xs font-semibold text-clay-muted sm:text-sm">
                    {f.desc}
                  </p>
                </div>
              </div>
            </CardClay>
          ))}
        </div>

        <div className="mt-8">
          <CardClay className="p-5 sm:p-7">
            {alreadyBeta ? (
              <div className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <CheckCircle2 size={28} />
                </span>
                <h2 className="mt-3 text-lg font-extrabold sm:text-xl">
                  Kamu sudah beta tester! 🎉
                </h2>
                <p className="mt-1 text-sm font-semibold text-clay-muted">
                  Fitur Rekam Suara &amp; Panggilan AI sudah terbuka di halaman
                  chat kamu.
                </p>
                <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
                  <Link href="/home">
                    <ButtonClay className="w-full sm:w-auto">Coba Sekarang</ButtonClay>
                  </Link>
                  <Link href="/dashboard">
                    <ButtonClay variant="secondary" className="w-full sm:w-auto">
                      Ke Dashboard
                    </ButtonClay>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <h2 className="text-lg font-extrabold sm:text-xl">
                  Siap mencoba fitur baru?
                </h2>
                <p className="mx-auto mt-1 max-w-md text-sm font-semibold text-clay-muted">
                  Klik tombol di bawah, dan akses beta langsung aktif di akunmu.
                  Tanpa biaya, tanpa menunggu persetujuan.
                </p>
                {error && (
                  <p className="mx-auto mt-3 max-w-md rounded-clay-md border-2 border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 sm:text-sm">
                    {error}
                  </p>
                )}
                <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                  <ButtonClay onClick={handleJoin} disabled={busy || loading}>
                    {busy ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 size={16} className="animate-spin" /> Mengaktifkan...
                      </span>
                    ) : isLoggedIn() ? (
                      "Gabung Beta Sekarang"
                    ) : (
                      <>
                        <LogIn size={16} className="mr-2" /> Masuk &amp; Gabung Beta
                      </>
                    )}
                  </ButtonClay>
                </div>
                <p className="mt-3 text-[11px] font-bold text-clay-muted">
                  Butuh akun — masuk dengan email/Google dulu, lalu kembali ke
                  halaman ini.
                </p>
              </div>
            )}
          </CardClay>
        </div>

        <p className="mt-8 text-center text-xs font-semibold text-clay-muted">
          Ada pertanyaan? Tanyakan lewat{" "}
          <Link href="/home" className="font-extrabold text-clay-primary underline">
            chat Eureka.AI
          </Link>{" "}
          ya.
        </p>
      </div>
    </main>
  );
}
