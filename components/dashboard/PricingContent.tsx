"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, CreditCard, History, Loader2, Printer } from "lucide-react";
import { toast } from "@yusufceng1z/ding-react";
import SlideToConfirm from "@/components/ui/SlideToConfirm";
import { TIER_PRICES } from "@/lib/paymentPricing";
import { usePremium } from "@/lib/usePremium";
import { apiFetch } from "@/lib/apiClient";
import type { ProductReview, ReviewStats } from "@/lib/reviews-store";
import { getUserId } from "@/lib/identity";
import { isLoggedIn, syncAuthSession } from "@/lib/auth";
import { useI18n } from "@/context/LocaleContext";
import { captureProductEvent } from "@/lib/productAnalytics";
import { isPaymentId } from "@/lib/paymentIds";
import LoadingStatus from "@/components/ui/LoadingStatus";
import "@/app/pricing/pricing.css";

const TIER_LABEL: Record<string, string> = {
  promo: "Promo",
  normal: "Normal",
  trial: "Trial",
};

interface PaymentHistoryItem {
  provider?: "mayar" | "pakasir";
  orderId: string;
  amount: number;
  tier: string;
  status: string;
  paidAt: string | null;
  createdAt: string | null;
}

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export default function PricingContent({ v2 = false }: { v2?: boolean }) {
  const { dict, locale } = useI18n();
  const p = dict.pricing;
  const pricingPath = v2 ? "/dashboard-v2/pricing" : "/pricing";
  const PERKS = locale === "en"
    ? ["AI chat and web search", "AI notes with chapters and mindmaps", "Quizzes, flashcards, and comprehension practice", "Voice calls with Momo and Lala", "Study planner and subject tools"]
    : ["Chat AI dan pencarian web", "Catatan AI lengkap dengan bab dan mindmap", "Kuis, flashcard, dan latihan pemahaman", "Panggilan suara dengan Momo dan Lala", "Jadwal belajar dan pengelolaan mata pelajaran"];
  const en = locale === "en";
  const router = useRouter();
  const { isPremium, tier, premiumUntil, freeAccessUntil, loading, refresh } = usePremium();
  const [signedIn, setSignedIn] = useState(false);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);
  // Ulasan nyata → JSON-LD Product (aggregateRating & review).
  const [reviewData, setReviewData] = useState<{
    reviews: ProductReview[];
    stats: ReviewStats;
  } | null>(null);

  // Riwayat pembelian & status langganan — hanya untuk user yang login.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await syncAuthSession().catch(() => undefined);
      if (cancelled || !isLoggedIn()) return;
      setSignedIn(true);
      setHistoryLoading(true);
      try {
        const res = await apiFetch(
          `/api/payments/history?userId=${encodeURIComponent(getUserId())}`
        );
        const payload = await res.json().catch(() => null);
        if (!cancelled && payload?.history) {
          setHistory(payload.history as PaymentHistoryItem[]);
        }
      } catch {
        // biarkan riwayat kosong
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Ulasan publik — hanya untuk JSON-LD Product (data nyata, tidak dipalsukan).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/reviews");
        const payload = await res.json().catch(() => null);
        if (!cancelled && payload?.stats) {
          setReviewData({
            reviews: payload.reviews ?? [],
            stats: payload.stats,
          });
        }
      } catch {
        // biarkan null — rating tidak ditambahkan ke JSON-LD
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [busy, setBusy] = useState(false);
  const checkoutLock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [discountCode, setDiscountCode] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const cancelDialog = useRef<HTMLDialogElement>(null);

  // ── Validasi kode diskon (Enter) → harga dicoret + harga final ──
  const [validating, setValidating] = useState(false);
  const [appliedCode, setAppliedCode] = useState<{
    code: string;
    label: string;
    finalAmount: number;
    remainingUses: number | null;
  } | null>(null);

  const applyCode = async () => {
    const code = discountCode.trim();
    if (!code || validating) return;
    setError(null);
    setValidating(true);
    setAppliedCode(null);
    try {
      const res = await apiFetch("/api/payments/validate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, tier: "normal" }),
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        code?: string;
        label?: string;
        finalAmount?: number;
        remainingUses?: number | null;
      } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? p.errInvalidCode);
        return;
      }
      setAppliedCode({
        code: body.code as string,
        label: body.label as string,
        finalAmount: body.finalAmount ?? TIER_PRICES.normal,
        remainingUses: body.remainingUses ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : p.errValidate);
    } finally {
      setValidating(false);
    }
  };

  const choosePlan = async () => {
    if (checkoutLock.current || validating || cancelling) return;
    checkoutLock.current = true;
    setError(null);
    setBusy(true);
    let redirecting = false;
    try {
      // Wajib akun asli (sync sesi) — id fallback random per-device ditolak
      // server dan membuat status tidak konsisten antar perangkat.
      await syncAuthSession().catch(() => undefined);
      if (!isLoggedIn()) {
        setError(p.errLoginFirst);
        router.push(`/${locale}/login?next=${encodeURIComponent(`/${locale}${pricingPath}`)}`);
        return;
      }
      const userId = getUserId();
      if (!userId) {
        setError(p.errLoginFirst);
        return;
      }
      const res = await apiFetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          tier: "normal",
          discountCode: appliedCode?.code,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        link?: string;
        transactionId?: string;
        error?: string;
      } | null;
      if (!res.ok || !body?.link) {
        setError(body?.error ?? p.errPayment);
        return;
      }
      if (v2) captureProductEvent({ name: "v2_pro_checkout_started", properties: { surface: "pricing" } });
      if (isPaymentId(body.transactionId)) {
        try { sessionStorage.setItem("eureka-pending-checkout", body.transactionId); } catch { /* Return URL also carries the order. */ }
      }
      // Redirect ke halaman pembayaran Mayar.
      window.location.href = body.link as string;
      redirecting = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : p.errPayment);
    } finally {
      if (!redirecting) {
        checkoutLock.current = false;
        setBusy(false);
      }
    }
  };


  const cancelPlan = async () => {
    setError(null);
    setCancelling(true);
    try {
      const userId = getUserId();
      if (!userId) {
        setError(p.errLoginCancel);
        return;
      }
      const res = await apiFetch("/api/payments/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? p.errCancel);
        cancelDialog.current?.close();
        return;
      }
      cancelDialog.current?.close();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : p.errCancel);
      cancelDialog.current?.close();
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  const printInvoice = async (orderId: string) => {
    if (printingId) return;
    setPrintingId(orderId);
    try {
      const token = await import("@/lib/supabase/client").then((m) => m.getAccessToken?.() ?? Promise.resolve(null)).catch(() => null);
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await apiFetch(
        `/api/payments/invoice?orderId=${encodeURIComponent(orderId)}&userId=${encodeURIComponent(getUserId())}`,
        { headers }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        toast.error(j?.error ?? "Gagal mengunduh invoice");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengunduh invoice");
    } finally {
      setPrintingId(null);
    }
  };


  const basePrice = formatRupiah(TIER_PRICES.normal);
  const displayPrice = formatRupiah(appliedCode?.finalAmount ?? TIER_PRICES.normal);
  const paymentLabel = busy ? p.toPakar : en ? "Slide to continue" : "Geser untuk lanjut bayar";
  const checkoutDisabled = busy || validating || cancelling ||
    (!!discountCode.trim() && !appliedCode);

  return (
    <div className={v2 ? "pro-page pro-page-v2" : "pro-page"}>
      {!v2 && <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: "Eureka.AI Pro",
            description:
              "AI Tutor Socratic untuk pelajar Indonesia: chat AI dengan manfaat Pro, catatan otomatis dari materi, kuis & kartu hafalan, dan kolaborasi real-time.",
            brand: { "@type": "Brand", name: "Eureka.AI" },
            offers: {
              "@type": "AggregateOffer",
              priceCurrency: "IDR",
              lowPrice: "0",
              highPrice: String(TIER_PRICES.normal),
              offerCount: "2",
              offers: [
                {
                  "@type": "Offer",
                  name: "Gratis",
                  price: "0",
                  priceCurrency: "IDR",
                  availability: "https://schema.org/InStock",
                },
                {
                  "@type": "Offer",
                  name: "Pro Bulanan",
                  price: String(TIER_PRICES.normal),
                  priceCurrency: "IDR",
                  availability: "https://schema.org/InStock",
                },
              ],
            },
            ...(reviewData?.stats && reviewData.stats.count > 0
              ? {
                  aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: String(reviewData.stats.average ?? 0),
                    bestRating: "5",
                    worstRating: "1",
                    reviewCount: reviewData.stats.count,
                  },
                  review: reviewData.reviews.slice(0, 3).map((r) => ({
                    "@type": "Review",
                    author: { "@type": "Person", name: r.authorName },
                    datePublished: r.createdAt.slice(0, 10),
                    reviewRating: {
                      "@type": "Rating",
                      ratingValue: String(r.rating),
                      bestRating: "5",
                    },
                    ...(r.title ? { name: r.title } : {}),
                    ...(r.content ? { reviewBody: r.content } : {}),
                  })),
                }
              : {}),
          }),
        }}
      />}
      {!v2 && <header className="pro-topbar">
        <Link href="/dashboard-v2" className="pro-brand">eureka!</Link>

      </header>}
      <main className="pro-main">
        {!v2 && <Link href="/dashboard-v2" className="pro-back"><ArrowLeft size={15} />{p.backHome}</Link>}
        <section className="pro-offer" aria-labelledby="pro-title">
          <div className="pro-story">
            <p className="pro-eyebrow">EUREKA PRO</p>
            <h1 id="pro-title">{en ? "Make more of every study session." : "Belajar lebih jauh dengan Momo."}</h1>
            <p>{en ? "Turn study material into notes, practise what you’ve learned, and ask Momo whenever you get stuck." : "Ubah materi jadi catatan, latihan dengan kuis dan flashcard, lalu tanya Momo kalau ada yang belum dipahami."}</p>
            <ul className="pro-benefits" aria-label={en ? "Pro benefits" : "Manfaat Pro"}>
              {PERKS.map(perk => <li key={perk}><Check size={17} aria-hidden="true" />{perk}</li>)}
            </ul>
          </div>
          <section className="pro-checkout" aria-label={freeAccessUntil ? (en ? "Free Pro access" : "Akses Pro gratis") : p.proMonthly}>
            {freeAccessUntil ? <>
              <h2>{en ? "Eureka Pro is free" : "Eureka Pro gratis"}</h2>
              <p className="pro-payment-note">{en ? "All accounts have free access until" : "Semua akun dapat akses gratis sampai"} {new Intl.DateTimeFormat(en ? "en-GB" : "id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(freeAccessUntil))} WIB.</p>
              <Link className="eureka-pro-cta" href="/dashboard-v2">{en ? "Start learning" : "Mulai belajar"}</Link>
              {tier !== "trial" && <div className="pro-active">
                <strong>{p.statusActive} · {TIER_LABEL[tier ?? ""] ?? "Pro"}</strong>
                {premiumUntil && <span>{p.until} {formatDate(premiumUntil)}</span>}
                <button type="button" onClick={() => { setError(null); cancelDialog.current?.showModal(); }}>{p.cancelSubscription}</button>
              </div>}
            </> : <>
            <h2>{p.proMonthly}</h2>
            <div className="pro-price">
              {appliedCode && appliedCode.finalAmount < TIER_PRICES.normal && <del>{basePrice}</del>}
              <strong>{displayPrice}</strong><span>{en ? "/ month" : "/ bulan"}</span>
            </div>
            <p className="pro-payment-note"><CreditCard size={16} aria-hidden="true" />{en ? "One payment for 30 days. No automatic renewal." : "Bayar sekali, aktif 30 hari. Tanpa perpanjangan otomatis."}</p>
            {loading ? <div className="pro-payment-note"><LoadingStatus stage="synchronizing" detail={en ? "Checking your plan" : "Memeriksa paketmu"} compact /></div> : <>
              {isPremium && <div className="pro-active">
                <strong>{p.statusActive} · {TIER_LABEL[tier ?? ""] ?? "Pro"}</strong>
                {premiumUntil && <span>{p.until} {formatDate(premiumUntil)}</span>}
                <button type="button" onClick={() => void refresh()}>{p.refreshStatus}</button>
                {tier !== "trial" && <button type="button" onClick={() => { setError(null); cancelDialog.current?.showModal(); }}>{p.cancelSubscription}</button>}
              </div>}
              <details className="pro-discount">
                <summary>{p.haveCode}<ChevronDown size={16} /></summary>
                <form onSubmit={event => { event.preventDefault(); void applyCode(); }}>
                  <input aria-label={p.haveCode} value={discountCode} disabled={validating || busy} placeholder={p.codePlaceholder}
                    onChange={event => { setDiscountCode(event.target.value.toUpperCase()); setAppliedCode(null); setError(null); }} />
                  <button type="submit" disabled={validating || busy || !discountCode.trim()}>{validating ? "…" : p.use}</button>
                </form>
                {appliedCode && <p role="status">{appliedCode.label}{appliedCode.remainingUses !== null && ` · ${p.remainingQuota.replace("{n}", String(appliedCode.remainingUses))}`}</p>}
              </details>
              {error && <p className="pro-error" role="alert">{error}</p>}
              <SlideToConfirm label={paymentLabel} busy={busy} disabled={checkoutDisabled} onConfirm={() => void choosePlan()} />
              <button className="pro-alternative" type="button" disabled={checkoutDisabled} onClick={() => void choosePlan()}>{en ? "Continue without sliding" : "Lanjut tanpa menggeser"}</button>
            </>}
            </>}
          </section>
        </section>
        {/* ── Riwayat Pembelian (semua status: premium & non-premium) ── */}
        {signedIn && (
          <div className="pro-history" id="riwayat">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-clay-dark">
              <History size={20} className="text-clay-primary" />
              {p.purchaseHistory}
            </h2>
            {historyLoading ? (
              <p className="mt-3 flex items-center gap-2 text-sm font-bold text-clay-muted">
                <Loader2 size={14} className="animate-spin" />
                {p.loadingHistory}
              </p>
            ) : history.length === 0 ? (
              <p className="mt-3 text-sm font-semibold text-clay-muted">
                {p.noPurchases}
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2.5">
                {history.map((h) => (
                  <li
                    key={h.orderId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-clay-md bg-clay-beige/70 px-4 py-3 text-sm shadow-clay-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-extrabold text-clay-dark">
                        {h.orderId}
                      </p>
                      <p className="text-xs font-bold text-clay-muted">
                        {formatDate(h.paidAt ?? h.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-clay-dark">
                        {formatRupiah(h.amount)}
                      </span>
                      <span className="rounded-clay-full bg-clay-primary/10 px-2.5 py-1 text-xs font-extrabold text-clay-primary">
                        {h.tier}
                      </span>
                      <span
                        className={`rounded-clay-full px-2.5 py-1 text-xs font-extrabold ${
                          h.status === "paid"
                            ? "bg-clay-success/15 text-clay-success"
                            : "bg-clay-muted/10 text-clay-muted"
                        }`}
                      >
                        {h.status === "paid" ? p.paid : p.unpaid}
                      </span>
                      {h.provider === "mayar" && h.status !== "paid" && isPaymentId(h.orderId) && <Link
                        className="pro-recheck-payment" href={`/dashboard-v2?upgrade=mayar&order=${h.orderId}`}>
                        {en ? "Check payment" : "Cek pembayaran"}
                      </Link>}
                      <button
                        onClick={() => void printInvoice(h.orderId)}
                        disabled={printingId === h.orderId}
                        title="Cetak invoice PDF"
                        className="inline-flex items-center gap-1 rounded-clay-full border-2 border-clay-borderLight bg-white px-2.5 py-1 text-xs font-extrabold text-clay-primary shadow-clay-sm transition-all hover:-translate-y-0.5 disabled:opacity-60"
                      >
                        {printingId === h.orderId ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Printer size={12} />
                        )}
                        PDF
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
      <dialog ref={cancelDialog} className="pro-modal" aria-labelledby="pro-cancel-title" aria-describedby="pro-cancel-desc"
        onCancel={event => { if (cancelling) event.preventDefault(); }}>
        <h2 id="pro-cancel-title">{p.cancelTitle}</h2>
        <p id="pro-cancel-desc">{p.cancelDesc}</p>
        <div>
          <button type="button" disabled={cancelling} onClick={() => cancelDialog.current?.close()}>{p.notNow}</button>
          <button type="button" disabled={cancelling} onClick={() => void cancelPlan()}>{cancelling ? p.cancelling : p.yesCancel}</button>
        </div>
      </dialog>
    </div>
  );
}
