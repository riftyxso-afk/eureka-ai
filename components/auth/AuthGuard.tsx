"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { isLoggedIn, syncAuthSession } from "@/lib/auth";

/**
 * Guard autentikasi untuk halaman dashboard.
 * Menyinkronkan sesi Supabase lalu mengarahkan ke /login bila belum masuk.
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
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-clay-beige">
        <Loader2 size={32} className="animate-spin text-clay-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
