"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Loader2,
  Mic,
  PhoneCall,
  Rocket,
  Sparkles,
} from "lucide-react";
import CardClay from "@/components/ui/CardClay";
import ButtonClay from "@/components/ui/ButtonClay";
import { useBeta } from "@/lib/useBeta";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { isLoggedIn, syncAuthSession } from "@/lib/auth";
import { useI18n } from "@/context/LocaleContext";

export default function JoinBetaPage() {
  const { dict } = useI18n();
  const j = dict.join;
  const BETA_FEATURES = [
    { icon: Mic, title: j.featRecTitle, desc: j.featRecDesc },
    { icon: PhoneCall, title: j.featCallTitle, desc: j.featCallDesc },
    { icon: Sparkles, title: j.featEarlyTitle, desc: j.featEarlyDesc },
  ];
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
        setError(j.errLogin);
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
        setError(body?.error ?? j.errJoin);
        return;
      }
      setJustJoined(true);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : j.errJoin);
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
            <Sparkles size={12} /> {j.chip}
          </span>
          <h1 className="mt-3 flex items-center justify-center gap-2 text-3xl font-extrabold sm:text-4xl">
            {j.title}
            <Rocket size={30} className="shrink-0 text-clay-secondary" />
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm font-semibold text-clay-muted sm:text-base">
            {j.subtitle}
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
                  {j.alreadyTitle}
                </h2>
                <p className="mt-1 text-sm font-semibold text-clay-muted">
                  {j.alreadyDesc}
                </p>
                <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
                  <Link href="/dashboard">
                    <ButtonClay className="w-full sm:w-auto">{j.tryNow}</ButtonClay>
                  </Link>
                  <Link href="/dashboard">
                    <ButtonClay variant="secondary" className="w-full sm:w-auto">
                      {j.keDashboard}
                    </ButtonClay>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <h2 className="text-lg font-extrabold sm:text-xl">
                  {j.readyTitle}
                </h2>
                <p className="mx-auto mt-1 max-w-md text-sm font-semibold text-clay-muted">
                  {j.readyDesc}
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
                        <Loader2 size={16} className="animate-spin" /> {j.activating}
                      </span>
                    ) : (
                      j.joinNow
                    )}
                  </ButtonClay>
                </div>
                <p className="mt-3 text-[11px] font-bold text-clay-muted">
                  {j.joinNote}
                </p>
              </div>
            )}
          </CardClay>
        </div>

        <p className="mt-8 text-center text-xs font-semibold text-clay-muted">
          {j.question}{" "}
          <Link href="/dashboard" className="font-extrabold text-clay-primary underline">
            {j.chatLink}
          </Link>{" "}
        </p>
      </div>
    </main>
  );
}
