"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  finishGoogleOAuth,
  getSafeNext,
  needsOnboarding,
  registerFriendsIdentity,
} from "@/lib/auth";
import { supabase, isSupabaseConfigured, getAccessToken } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";

const SESSION_TIMEOUT_MS = 20000;

/** Halaman balikan (redirect) setelah login/daftar dengan Google. */
export default function AuthCallbackPage() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let subscription: { unsubscribe: () => void } | null = null;
    let settled = false;

    const redirect = (path: string) => {
      if (settled) return;
      settled = true;
      subscription?.unsubscribe();
      router.replace(path);
    };

    /** Cache sesi + daftarkan identitas ke backend teman + arahkan ke tujuan. */
    const finalize = async (): Promise<boolean> => {
      const result = await finishGoogleOAuth();
      if (!result.ok || !result.user) return false;

      await registerFriendsIdentity(result.user.name);

      const needOnboarding = await needsOnboarding().catch(() => false);

      // Referral: akun BARU (butuh onboarding) yang datang dari link ?ref=...
      // dicatat sebagai rujukan pengundang (best-effort, tidak memblokir).
      const ref =
        new URLSearchParams(window.location.search).get("ref") ?? "";
      if (needOnboarding && ref) {
        try {
          const token = await getAccessToken();
          if (token) {
            await apiFetch("/api/referral/apply", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ userId: getUserId(), ref }),
            });
          }
        } catch (e) {
          console.warn("[auth/callback] atribusi referral dilewati:", e);
        }
      }

      redirect(needOnboarding ? "/onboarding" : getSafeNext());
      return true;
    };

    const run = async () => {
      // Google / Supabase menandai kegagalan lewat ?error=...
      // (dibaca dari window.location agar halaman bisa di-prerender statis)
      if (new URLSearchParams(window.location.search).get("error")) {
        redirect(
          `/login?error=${encodeURIComponent(
            "Login Google dibatalkan atau gagal. Silakan coba lagi."
          )}`
        );
        return;
      }

      if (!isSupabaseConfigured() || !supabase) {
        redirect(
          `/login?error=${encodeURIComponent(
            "Supabase belum dikonfigurasi untuk login Google."
          )}`
        );
        return;
      }

      // Kebanyakan kasus: token sudah di URL dan sesi langsung terbaca.
      if (await finalize()) return;

      // Token kadang masih diproses → tunggu event SIGNED_IN dari supabase-js.
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          void finalize();
        }
      });
      subscription = data.subscription;

      // Pengaman: jangan biarkan halaman menunggu selamanya.
      setTimeout(() => {
        redirect(
          `/login?error=${encodeURIComponent(
            "Sesi Google tidak ditemukan. Silakan coba lagi."
          )}`
        );
      }, SESSION_TIMEOUT_MS);
    };

    void run();

    return () => {
      subscription?.unsubscribe();
    };
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-clay-beige px-4">
      <img
        src="/holo-sticker.gif"
        alt="Logo Eureka.AI"
        style={{ mixBlendMode: "screen" }}
        className="h-14 w-14 object-contain"
      />
      <div className="mt-6 flex items-center gap-3 rounded-clay-md border-2 border-clay-shadow/40 bg-white px-6 py-4 shadow-clay-sm">
        <Loader2 size={22} className="animate-spin text-clay-primary" />
        <p className="text-sm font-extrabold text-clay-dark">
          Menyelesaikan masuk dengan Google...
        </p>
      </div>
    </div>
  );
}
