"use client";

import { toast } from "@yusufceng1z/ding-react";
import { Crown } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { isLoggedIn, syncAuthSession } from "@/lib/auth";
import { getUserId } from "@/lib/identity";
import { isPaymentId } from "@/lib/paymentIds";
import { PREMIUM_UPDATED_EVENT } from "@/lib/usePremium";
import { playCelebrationSound } from "@/lib/notifySound";
import "./pro-access.css";

function PremiumSuccessPopupInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params.toString();
  const [success, setSuccess] = useState(false);
  const [checking, setChecking] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const handledOrder = useRef<string | null>(null);

  useEffect(() => {
    const search = new URLSearchParams(query);
    let pendingOrder: string | null = null;
    try { pendingOrder = sessionStorage.getItem("eureka-pending-checkout"); } catch { /* Storage can be unavailable. */ }
    const upgrade = search.get("upgrade");
    const order = search.get("order") ?? pendingOrder;
    const returningToDashboard = /^\/(?:id\/|en\/)?dashboard-v2\/?$/.test(pathname);
    const mayar = isPaymentId(order) && (upgrade === "mayar" || (!upgrade && returningToDashboard));
    if (!mayar && upgrade !== "done") return;
    if (!upgrade && handledOrder.current === order) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const { signal } = controller;

    const finish = (paid: boolean, closed = false, inactive = false) => {
      handledOrder.current = order;
      search.delete("upgrade");
      search.delete("order");
      router.replace(window.location.pathname + (search.size ? `?${search}` : ""), { scroll: false });
      setChecking(false);
      if (paid) {
        try { sessionStorage.removeItem("eureka-pending-checkout"); } catch { /* The verified result remains authoritative. */ }
        setSuccess(true);
        window.dispatchEvent(new Event(PREMIUM_UPDATED_EVENT));
        playCelebrationSound();
      } else {
        if (closed || inactive) {
          try { sessionStorage.removeItem("eureka-pending-checkout"); } catch { /* Ignore unavailable storage. */ }
        }
        toast.warning(inactive ? "Masa aktif dari pembayaran ini sudah berakhir." : closed ? "Tautan pembayaran sudah ditutup." : "Pembayaran masih menunggu konfirmasi.", {
          action: { label: "Lihat riwayat", onClick: () => router.push("/dashboard-v2/pricing#riwayat") },
        });
      }
    };

    const check = async () => {
      if (signal.aborted) return;
      attempts++;
      try {
        if (attempts === 1) await syncAuthSession().catch(() => undefined);
        if (signal.aborted || !isLoggedIn()) return;
        setChecking(true);
        const response = await (mayar
          ? apiFetch("/api/payments/mayar/confirm", {
              method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order }),
            })
          : apiFetch(`/api/payments/status?userId=${encodeURIComponent(getUserId())}`, { signal }));
        const result = await response.json().catch(() => null);
        if (signal.aborted) return;
        if (response.ok && (mayar ? result?.status === "paid" && result?.isPremium === true : result?.isPremium === true)) return finish(true);
        if (response.ok && mayar && result?.status === "paid" && result?.isPremium === false) return finish(false, false, true);
        if (response.status === 404 || result?.status === "closed") return finish(false, true);
      } catch {
        // Network or provider processing can be delayed.
      }
      if (signal.aborted) return;
      if (attempts < 10) timer = setTimeout(check, 3000);
      else finish(false);
    };
    void check();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [query, pathname, router]);

  useEffect(() => {
    const element = dialog.current;
    if (success && element && !element.open) element.showModal();
    return () => { if (element?.open) element.close(); };
  }, [success]);

  return <>
    {checking && <p className="eureka-pro-checkout-status" role="status">Memverifikasi pembayaran…</p>}
    {success && <dialog ref={dialog} className="eureka-pro-success" aria-labelledby="eureka-pro-success-title"
      onCancel={event => { event.preventDefault(); setSuccess(false); }}>
      <span className="eureka-pro-emblem"><Crown size={28} aria-hidden="true" /></span>
      <span className="eureka-pro-kicker">EUREKA PRO</span>
      <h2 id="eureka-pro-success-title">Eureka Pro sudah aktif!</h2>
      <p>Catatan AI, bab, kuis, flashcard, dan panggilan Momo sudah bisa kamu gunakan.</p>
      <button className="eureka-pro-cta" type="button" onClick={() => setSuccess(false)}>Mulai belajar</button>
    </dialog>}
  </>;
}

export default function PremiumSuccessPopup() {
  return <Suspense fallback={null}><PremiumSuccessPopupInner /></Suspense>;
}
