"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/context/OnboardingContext";

export default function Home() {
  const router = useRouter();
  const { isComplete, hydrated } = useOnboarding();

  useEffect(() => {
    if (!hydrated) return;
    router.replace(isComplete ? "/dashboard" : "/onboarding");
  }, [hydrated, isComplete, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-clay-beige">
      <div className="h-16 w-16 animate-bounce rounded-full bg-clay-primary shadow-clay-btn" />
    </div>
  );
}
