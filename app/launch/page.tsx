"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Crown,
  Gift,
  Loader2,
  Mic,
  PhoneCall,
  Rocket,
  Sparkles,
} from "lucide-react";
import CardClay from "@/components/ui/CardClay";
import ButtonClay from "@/components/ui/ButtonClay";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { isLoggedIn, syncAuthSession } from "@/lib/auth";
import { useI18n } from "@/context/LocaleContext";

type Phase = "checking" | "guest" | "working" | "done";

interface TrialState {
  ok: boolean;
  premiumUntil?: string;
  message?: string;
}

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Halaman kampanye /launch — untuk user yang LOGIN, membuka link ini
 * otomatis: (1) klaim trial Pro 7 hari (sekali seumur hidup) dan
 * (2) mengaktifkan akses beta tester. Idempoten & aman — tanpa sesi,
 * halaman hanya menampilkan CTA masuk.
 */
export default function LaunchPage() {
  const { locale, dict } = useI18n();
  const l = dict.launch;
  const PERKS = [
    { icon: Crown, title: l.perks[0].title, desc: l.perks[0].desc },
    { icon: Mic, title: l.perks[1].title, desc: l.perks[1].desc },
    { icon: PhoneCall, title: l.perks[2].title, desc: l.perks[2].desc },
    { icon: Sparkles, title: l.perks[3].title, desc: l.perks[3].desc },
  ];
  const [phase, setPhase] = useState<Phase>("checking");
  const [trial, setTrial] = useState<TrialState | null>(null);
  const [betaOk, setBetaOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await syncAuthSession();
      } catch {
        // abaikan; isLoggedIn() membaca cache
      }
      if (cancelled) return;
      if (!isLoggedIn()) {
        setPhase("guest");
        return;
      }
      const userId = getUserId();
      if (!userId) {
        setPhase("guest");
        return;
      }

      setPhase("working");
      const [trialRes, betaRes] = await Promise.all([
        apiFetch("/api/payments/trial", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        }),
        apiFetch("/api/beta/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        }),
      ]);

      const t = (await trialRes.json().catch(() => null)) as {
        ok?: boolean;
        premiumUntil?: string;
        error?: string;
      } | null;
      const b = (await betaRes.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (cancelled) return;
      setTrial({
        ok: trialRes.ok && t?.ok === true,
        premiumUntil: t?.premiumUntil ?? undefined,
        message: trialRes.ok ? undefined : (t?.error ?? "Gagal klaim trial."),
      });
      setBetaOk(betaRes.ok && b?.ok === true);
      if (!trialRes.ok && !betaRes.ok) {
        setError(l.claimFail);
      }
      setPhase("done");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-clay-beige px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-clay-full bg-clay-primary/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-clay-primary">
            <Gift size={12} /> {l.chip}
          </span>
          <h1 className="mt-3 flex flex-wrap items-center justify-center gap-2 text-3xl font-extrabold sm:text-4xl">
            {l.title}
            <Rocket size={30} className="shrink-0 text-clay-secondary" />
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm font-semibold text-clay-muted sm:text-base">
            {l.subtitle}
          </p>
        </div>

        {/* Daftar hadiah */}
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          {PERKS.map((f) => (
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

        {/* Status / aksi */}
        <div className="mt-8">
          <CardClay className="p-5 sm:p-7">
            {phase === "checking" && (
              <div className="flex items-center justify-center gap-2 py-4 text-sm font-extrabold text-clay-muted">
                <Loader2 size={18} className="animate-spin text-clay-primary" />
                {l.checking}
              </div>
            )}

            {phase === "guest" && (
              <div className="text-center">
                <h2 className="text-lg font-extrabold sm:text-xl">
                  {l.guestTitle}
                </h2>
                <p className="mx-auto mt-1 max-w-md text-sm font-semibold text-clay-muted">
                  {l.guestDesc}
                </p>
                <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                  <Link href="/login?next=/launch">
                    <ButtonClay className="w-full sm:w-auto">{l.masukKlaim}</ButtonClay>
                  </Link>
                  <Link href="/register?next=/launch">
                    <ButtonClay variant="secondary" className="w-full sm:w-auto">
                      {l.daftarGratis}
                    </ButtonClay>
                  </Link>
                </div>
                <p className="mt-3 text-[11px] font-bold text-clay-muted">
                  {l.guestNote}
                </p>
              </div>
            )}

            {phase === "working" && (
              <div className="py-2 text-center">
                <Loader2 size={26} className="mx-auto animate-spin text-clay-primary" />
                <p className="mt-3 text-sm font-extrabold text-clay-dark">
                  {l.workingTitle}
                </p>
                <p className="mt-1 text-xs font-semibold text-clay-muted">
                  {l.workingDesc}
                </p>
              </div>
            )}

            {phase === "done" && (
              <div className="space-y-3">
                {/* Status trial */}
                <div
                  className={`flex items-start gap-3 rounded-clay-md border-2 p-4 ${
                    trial?.ok
                      ? "border-green-200 bg-green-50"
                      : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                      trial?.ok ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"
                    }`}
                  >
                    {trial?.ok ? <CheckCircle2 size={22} /> : <Crown size={22} />}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-extrabold sm:text-lg">
                      {trial?.ok
                        ? l.trialActive
                        : trial?.message ?? l.trialUnavailable}
                    </h2>
                    <p className="mt-0.5 text-xs font-semibold text-clay-muted sm:text-sm">
                      {trial?.ok && trial?.premiumUntil
                        ? `${l.trialUntil} ${formatDate(trial.premiumUntil, locale)} — ${l.trialUntilDesc}`
                        : trial?.message
                          ? `${trial.message} ${l.stillFree}`
                          : l.stillFree}
                    </p>
                  </div>
                </div>

                {/* Status beta */}
                <div
                  className={`flex items-start gap-3 rounded-clay-md border-2 p-4 ${
                    betaOk ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                      betaOk ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"
                    }`}
                  >
                    {betaOk ? <CheckCircle2 size={22} /> : <Sparkles size={22} />}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-extrabold sm:text-lg">
                      {betaOk ? l.betaActive : l.betaUnavailable}
                    </h2>
                    <p className="mt-0.5 text-xs font-semibold text-clay-muted sm:text-sm">
                      {betaOk ? l.betaActiveDesc : l.betaFail}
                    </p>
                  </div>
                </div>

                {error && (
                  <p className="rounded-clay-md border-2 border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 sm:text-sm">
                    {error}
                  </p>
                )}

                <div className="flex flex-col justify-center gap-2 pt-1 sm:flex-row">
                  <Link href="/home">
                    <ButtonClay className="w-full sm:w-auto">{l.mulalBelajar}</ButtonClay>
                  </Link>
                  <Link href="/dashboard">
                    <ButtonClay variant="secondary" className="w-full sm:w-auto">
                      {l.keDashboard}
                    </ButtonClay>
                  </Link>
                </div>
              </div>
            )}
          </CardClay>
        </div>

        <p className="mt-8 text-center text-xs font-semibold text-clay-muted">
          {l.footer} {l.question}{" "}
          <Link href="/home" className="font-extrabold text-clay-primary underline">
            {l.chatLink}
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
