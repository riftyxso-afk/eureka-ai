"use client";

import { toast } from "@yusufceng1z/ding-react";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { syncAuthSession } from "@/lib/auth";

/** Interval polling status premium saat kembali dari Pakasir. */
const POLL_INTERVAL_MS = 2500;
/** Maksimal percobaan (±15 detik) — memberi waktu webhook Pakasir memproses. */
const POLL_MAX_ATTEMPTS = 6;

/**
 * Popup hasil pembayaran setelah user kembali dari checkout Pakasir.
 *
 * Trigger: query `?upgrade=done` (redirect Pakasir netral — tidak mengklaim
 * hasil pembayaran; Pakasir hanya mengarahkan kembali setelah bayar sukses).
 * Popup sukses HANYA muncul bila server mengonfirmasi
 * premium aktif (`GET /api/payments/status`), dengan polling singkat untuk
 * menunggu webhook Pakasir. Bila pembayaran tidak selesai (batal/gagal/timeout),
 * tampilkan notifikasi netral — tanpa klaim sukses. Query dibersihkan setelah
 * ditangani agar tidak muncul lagi saat refresh.
 */
function PremiumSuccessPopupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    const isDone = searchParams.get("upgrade") === "done";
    if (!isDone) return;

    // Bersihkan query ?upgrade=... dari URL agar tidak diproses ulang.
    const clearUpgradeParam = () => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("upgrade");
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
    };

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const checkStatus = async () => {
      if (cancelled || handled.current) return;
      attempts += 1;
      try {
        // Pastikan userId = akun asli (bukan fallback random per-device) agar
        // status premium benar di perangkat mana pun dengan akun yang sama.
        await syncAuthSession().catch(() => undefined);
        const userId = getUserId();
        const res = await apiFetch(
          `/api/payments/status?userId=${encodeURIComponent(userId)}`
        );
        const data = res.ok
          ? ((await res.json()) as { isPremium?: boolean })
          : null;
        if (cancelled || handled.current) return;
        if (data?.isPremium) {
          // Server mengonfirmasi premium aktif → tampilkan popup sukses.
          // PENTING: `handled` di-set DI SINI (setelah hasil nyata), bukan
          // sebelum scheduling — React StrictMode (dev) menjalankan effect
          // dua kali; cleanup membatalkan poller lama via `cancelled`.
          handled.current = true;
          clearUpgradeParam();
          toast.success("Eureka Pro sudah aktif", {
            description: "Kamu sudah bisa menggunakan manfaat Pro di akunmu.",
            action: { label: "Mulai belajar", onClick: () => router.push("/dashboard-v2") },
          });
          return;
        }
      } catch {
        // gagal sementara → lanjut polling berikutnya
      }
      if (cancelled || handled.current) return;
      if (attempts < POLL_MAX_ATTEMPTS) {
        timer = setTimeout(checkStatus, POLL_INTERVAL_MS);
      } else {
        // Timeout — pembayaran tidak selesai (batal/gagal/webhook belum
        // sampai): notifikasi netral, TANPA klaim sukses.
        handled.current = true;
        clearUpgradeParam();
        toast.warning("Pembayaran belum selesai — kamu masih di paket Free");
      }
    };

    // Mulai polling setelah halaman selesai render.
    timer = setTimeout(checkStatus, 600);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [searchParams, router]);

  return null;
}

/**
 * useSearchParams butuh Suspense boundary — kalau tidak, halaman statis
 * gagal di-prerender (build error). Komponen ini dirender di root layout,
 * jadi wajib dibungkus.
 */
export default function PremiumSuccessPopup() {
  return (
    <Suspense fallback={null}>
      <PremiumSuccessPopupInner />
    </Suspense>
  );
}
