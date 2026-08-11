"use client";

import Link from "next/link";
import { Crown } from "lucide-react";
import CardClay from "@/components/ui/CardClay";
import ButtonClay from "@/components/ui/ButtonClay";
import { useOnboarding } from "@/context/OnboardingContext";

const PERKS = [
  "Sesi belajar tak terbatas",
  "Prioritas fitur baru",
  "Rencana belajar personal 3 hari",
  "Analisis kelemahan mendalam",
];

export default function PricingPage() {
  const { data } = useOnboarding();

  const choosePlan = (plan: "pro" | "free") => {
    try {
      localStorage.setItem("eureka_plan", plan);
    } catch {
      // storage unavailable
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-clay-beige px-4 py-10">
      <CardClay className="w-full max-w-md text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-clay-secondary shadow-clay-thumb">
          <Crown size={36} className="text-white" />
        </div>
        <h1 className="mt-5 text-3xl font-extrabold">Tingkatkan ke Pro</h1>
        <p className="mt-2 text-base font-semibold text-clay-muted">
          {data.name ? `Halo, ${data.name.split(" ")[0]}! ` : ""}Dapatkan
          pengalaman belajar tanpa batas.
        </p>
        <p className="mt-6 text-5xl font-extrabold">
          Rp 59.000
          <span className="text-lg font-bold text-clay-muted">/bulan</span>
        </p>
        <ul className="mt-6 flex flex-col gap-3 text-left">
          {PERKS.map((p) => (
            <li
              key={p}
              className="flex items-center gap-3 rounded-clay-md bg-clay-beige/70 px-5 py-3 text-base font-bold shadow-clay-sm"
            >
              <span className="text-clay-success">✓</span>
              {p}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-col gap-3">
          <ButtonClay fullWidth onClick={() => choosePlan("pro")}>
            👑 Aktifkan Pro Sekarang
          </ButtonClay>
          <Link href="/dashboard">
            <ButtonClay fullWidth variant="secondary" onClick={() => choosePlan("free")}>
              Nanti aja
            </ButtonClay>
          </Link>
        </div>
      </CardClay>
    </div>
  );
}
