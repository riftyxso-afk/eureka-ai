"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, needsOnboarding, syncAuthSession } from "@/lib/auth";
import { PageLoader } from "@/components/ui/PageLoader";
import { restoreInstalledAccount } from "@/lib/installedAccount";

/**
 * Guard autentikasi untuk halaman dashboard.
 * Menyinkronkan sesi Supabase, lalu mengarahkan ke /login bila belum masuk,
 * atau ke /onboarding bila profil belum lengkap.
 */
export default function AuthGuard({ children, hideLoader = false }: { children: React.ReactNode; hideLoader?: boolean }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Local development preview only; deployed builds retain the normal guard.
    if (process.env.NODE_ENV === "development" && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(window.location.hostname)) {
      setReady(true);
      return;
    }
    (async () => {
      try {
        await syncAuthSession();
        if (!isLoggedIn()) await restoreInstalledAccount();
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
    if (hideLoader) return null;
    return <PageLoader title="Memeriksa sesi kamu..." />;
  }

  return <>{children}</>;
}
