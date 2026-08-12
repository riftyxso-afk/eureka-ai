"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, needsOnboarding, syncAuthSession } from "@/lib/auth";
import { PageLoader } from "@/components/ui/PageLoader";

/**
 * Guard autentikasi untuk halaman dashboard.
 * Menyinkronkan sesi Supabase, lalu mengarahkan ke /login bila belum masuk,
 * atau ke /onboarding bila profil belum lengkap.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await syncAuthSession();
      } catch {
        // abaikan; isLoggedIn() tetap membaca cache
      }
      if (cancelled) return;
      if (!isLoggedIn()) {
        router.replace("/login");
        return;
      }
      
      const needOnboarding = await needsOnboarding().catch(() => false);
      if (cancelled) return;
      if (needOnboarding) {
        router.replace("/onboarding");
        return;
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return <PageLoader title="Memeriksa sesi kamu..." />;
  }

  return <>{children}</>;
}
