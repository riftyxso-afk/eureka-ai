"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  CreditCard,
  Crown,
  Gift,
  History,
  Loader2,
  Printer,
  Ticket,
  Zap,
} from "lucide-react";
import CardClay from "@/components/ui/CardClay";
import ButtonClay from "@/components/ui/ButtonClay";
import { useOnboarding } from "@/context/OnboardingContext";
import { usePremium } from "@/lib/usePremium";
import { apiFetch } from "@/lib/apiClient";
import type { ProductReview, ReviewStats } from "@/lib/reviews-store";
import { getUserId } from "@/lib/identity";
import { isLoggedIn, syncAuthSession } from "@/lib/auth";
import { useI18n } from "@/context/LocaleContext";
import { MODEL_CATALOG } from "@/lib/modelCatalog";

/** Daftar model untuk bagian "Model AI yang kamu dapat" — dari katalog. */
const FREE_MODELS = MODEL_CATALOG.filter((m) => !m.premiumOnly);
const PRO_MODELS = MODEL_CATALOG.filter((m) => m.premiumOnly);

const TIERS = [
  {
    id: "normal" as const,
    price: 59000,
    highlight: false,
  },
];

const TIER_LABEL: Record<string, string> = {
  promo: "Promo",
  normal: "Normal",
  trial: "Trial",
};

interface PaymentHistoryItem {
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

export default function PricingPage() {
  const { dict, locale } = useI18n();
  const p = dict.pricing;
  const PERKS = p.perks;
  const { data } = useOnboarding();
  const { isPremium, tier, premiumUntil, loading, refresh } = usePremium();
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
    if (!isLoggedIn()) return;
    let cancelled = false;
    (async () => {
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

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [discountCode, setDiscountCode] = useState("");
  const [claimingTrial, setClaimingTrial] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // ── Validasi kode diskon (Enter) → harga dicoret + harga final ──
  const [validating, setValidating] = useState(false);
  const [appliedCode, setAppliedCode] = useState<{
    code: string;
    label: string;
    finalAmount: number;
    free: boolean;
    remainingUses: number | null;
  } | null>(null);
  const [priceCrossed, setPriceCrossed] = useState(false);

  const applyCode = async () => {
    const code = discountCode.trim();
    if (!code || validating) return;
    setError(null);
    setValidating(true);
    setAppliedCode(null);
    setPriceCrossed(false);
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
        free?: boolean;
        remainingUses?: number | null;
      } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? p.errInvalidCode);
        return;
      }
      setAppliedCode({
        code: body.code as string,
        label: body.label as string,
        finalAmount: body.finalAmount ?? 0,
        free: body.free === true,
        remainingUses: body.remainingUses ?? null,
      });
      // Animasi coret harga setelah kartu harga ter-render.
      requestAnimationFrame(() =>
        setTimeout(() => setPriceCrossed(true), 150)
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : p.errValidate);
    } finally {
      setValidating(false);
    }
  };

  const choosePlan = async (plan: "promo" | "normal") => {
    setError(null);
    setBusy(plan);
    try {
      // Wajib akun asli (sync sesi) — id fallback random per-device ditolak
      // server dan membuat status tidak konsisten antar perangkat.
      await syncAuthSession().catch(() => undefined);
      if (!isLoggedIn()) {
        setError(p.errLoginFirst);
        setBusy(null);
        window.location.href = "/login";
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
          tier: plan,
          discountCode: appliedCode?.code ?? (discountCode.trim() || undefined),
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        link?: string;
        activated?: boolean;
        error?: string;
      } | null;
      if (!res.ok || (!body?.link && !body?.activated)) {
        setError(body?.error ?? p.errPayment);
        return;
      }
      // Kode gratis 100% → sudah aktif langsung, tanpa diarahkan ke Pakasir.
      if (body.activated) {
        await refresh();
        return;
      }
      // Redirect ke halaman pembayaran Pakasir.
      window.location.href = body.link as string;
    } catch (e) {
      setError(e instanceof Error ? e.message : p.errPayment);
    } finally {
      setBusy(null);
    }
  };

  const claimTrial = async () => {
    setError(null);
    setClaimingTrial(true);
    try {
      // Wajib akun asli (sync sesi) — trial dicatat per akun di server.
      await syncAuthSession().catch(() => undefined);
      if (!isLoggedIn()) {
        setError(p.errLoginTrial);
        setClaimingTrial(false);
        window.location.href = "/login";
        return;
      }
      const userId = getUserId();
      if (!userId) {
        setError(p.errLoginTrial);
        return;
      }
      const res = await apiFetch("/api/payments/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? p.errTrial);
        return;
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : p.errTrial);
    } finally {
      setClaimingTrial(false);
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
        setConfirmCancel(false);
        return;
      }
      setConfirmCancel(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : p.errCancel);
      setConfirmCancel(false);
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
        alert(j?.error ?? "Gagal mengunduh invoice");
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
      alert(e instanceof Error ? e.message : "Gagal mengunduh invoice");
    } finally {
      setPrintingId(null);
    }
  };


  return (
    <div className="flex min-h-screen items-center justify-center bg-clay-beige px-4 py-10">
      {/* Data terstruktur untuk mesin pencari (Product/Offer, IDR) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: "Eureka.AI Pro",
            description:
              "AI Tutor Socratic untuk pelajar Indonesia: chat AI tanpa batas, catatan otomatis dari materi, kuis & kartu hafalan, dan kolaborasi real-time.",
            brand: { "@type": "Brand", name: "Eureka.AI" },
            offers: {
              "@type": "AggregateOffer",
              priceCurrency: "IDR",
              lowPrice: "0",
              highPrice: "59000",
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
                  price: "59000",
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
      />
      <CardClay className="w-full max-w-5xl">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-clay-secondary shadow-clay-thumb">
            <Crown size={36} className="text-white" />
          </div>
          <h1 className="mt-5 flex items-center justify-center gap-2 text-3xl font-extrabold">
            {isPremium ? (
              <>
                {p.alreadyPro} <Crown size={26} className="text-clay-secondary" />
              </>
            ) : (
              p.upgrade
            )}
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-base font-semibold text-clay-muted">
            {p.subtitle}
          </p>
          <p className="mx-auto mt-1 max-w-xl text-base font-semibold text-clay-muted">
            {isPremium ? (
              <>
                {p.activeUntil}{" "}
                <span className="font-extrabold text-clay-primary">
                  {TIER_LABEL[tier ?? ""] ?? "Pro"}
                </span>
                {premiumUntil && (
                  <>
                    {" "}{p.until}{" "}
                    <span className="font-extrabold">
                      {formatDate(premiumUntil)}
                    </span>
                  </>
                )}
                .
              </>
            ) : (
              <>
                {data.name ? `${p.hello}, ${data.name.split(" ")[0]}! ` : ""}{p.getUnlimited}
              </>
            )}
          </p>
        </div>

        {loading ? (
          <div className="mt-10 flex justify-center text-clay-muted">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : isPremium ? (
          /* ── Status premium (landscape) ───────────────────── */
          <div className="mt-8 flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
            <div className="w-full max-w-md rounded-clay-md bg-clay-beige/70 px-6 py-5 text-left shadow-clay-sm">
              <p className="text-sm font-bold text-clay-muted">
                {p.statusActive}
              </p>
              <p className="mt-1 text-sm font-semibold text-clay-dark">
                {tier === "trial" ? p.trialActiveDesc : p.proActiveDesc}
              </p>
            </div>
            <div className="flex w-full max-w-md flex-col gap-3">
              <ButtonClay
                fullWidth
                onClick={() => void choosePlan("normal")}
                disabled={busy !== null}
              >
                {busy === "normal" ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    {p.toPakar}
                  </span>
                ) : (
                  p.topUp
                )}
              </ButtonClay>
              <ButtonClay
                fullWidth
                variant="secondary"
                onClick={() => void refresh()}
              >
                {p.refreshStatus}
              </ButtonClay>
              <Link href="/dashboard">
                <ButtonClay fullWidth>{p.backHome}</ButtonClay>
              </Link>
              {tier !== "trial" && (
                <button
                  onClick={() => {
                    setError(null);
                    setConfirmCancel(true);
                  }}
                  className="rounded-clay-md px-5 py-2.5 text-sm font-extrabold text-red-500 transition-colors hover:bg-red-50"
                >
                  {p.cancelSubscription}
                </button>
              )}
            </div>
          </div>
        ) : (
          /* ── Landscape 2 kolom: kiri = pilih paket, kanan = benefit ── */
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            {/* KIRI: trial + paket + diskon */}
            <div className="space-y-4">
              {error && (
                <p className="rounded-clay-md bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                  {error}
                </p>
              )}

              {/* Claim trial */}
              <div className="rounded-clay-md border-2 border-dashed border-clay-primary/40 bg-clay-primary/5 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-base font-extrabold text-clay-primary">
                      <Gift size={18} /> {p.freeTrial7}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-clay-muted">
                      {p.trialDesc}
                    </p>
                  </div>
                  <ButtonClay
                    className="shrink-0"
                    disabled={claimingTrial}
                    onClick={() => void claimTrial()}
                  >
                    {claimingTrial ? (
                      <span className="flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" />
                        {p.activating}
                      </span>
                    ) : (
                      p.claimTrial
                    )}
                  </ButtonClay>
                </div>
              </div>

              {/* Paket */}
              <div className="grid gap-4 sm:grid-cols-2">
                {TIERS.map((t) => (
                  <div
                    key={t.id}
                    className={`rounded-clay-md px-5 py-4 text-left shadow-clay-sm ${
                      t.highlight
                        ? "border-2 border-red-300 bg-red-50/60"
                        : "bg-clay-beige/70"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-base font-extrabold">{p.proMonthly}</p>
                      {appliedCode?.free && (
                        <span className="rounded-full bg-green-500 px-2 py-0.5 text-[11px] font-extrabold text-white">
                          {p.free100}
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      {appliedCode?.free ? (
                        <>
                          {/* Harga normal dicoret (animasi) → Rp 500 (simbolis,
                              minimal transaksi Pakasir) */}
                          <p
                            className={`text-3xl font-extrabold text-gray-400 transition-all duration-700 ${
                              priceCrossed
                                ? "line-through decoration-red-500 decoration-[3px]"
                                : ""
                            }`}
                          >
                            Rp {t.price.toLocaleString("id-ID")}
                            <span className="text-sm font-bold text-clay-muted">
                              /bulan
                            </span>
                          </p>
                          <p className="text-4xl font-extrabold text-green-600">
                            Rp 500
                            <span className="text-sm font-bold text-green-400">
                              /bulan
                            </span>
                          </p>
                        </>
                      ) : (
                        <p className="text-3xl font-extrabold">
                          Rp {t.price.toLocaleString("id-ID")}
                          <span className="text-sm font-bold text-clay-muted">
                            /bulan
                          </span>
                        </p>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-semibold text-clay-muted">
                      {appliedCode?.free ? appliedCode.label : p.normalPrice}
                    </p>
                    <ButtonClay
                      fullWidth
                      className="mt-3"
                      disabled={busy !== null}
                      onClick={() => void choosePlan(t.id)}
                    >
                      {busy === t.id ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 size={16} className="animate-spin" />
                          {p.toPakar}
                        </span>
                      ) : appliedCode?.free ? (
                        p.claimFree
                      ) : (
                        `${p.choose} ${p.proMonthly}`
                      )}
                    </ButtonClay>
                  </div>
                ))}
              </div>

              {/* Kode diskon */}
              <div className="rounded-clay-md bg-clay-beige/70 px-5 py-4 text-left shadow-clay-sm">
                <label className="flex items-center gap-2 text-sm font-extrabold text-clay-dark">
                  <Ticket size={16} className="text-clay-primary" />
                  {p.haveCode}
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    value={discountCode}
                    onChange={(e) => {
                      setDiscountCode(e.target.value.toUpperCase());
                      setAppliedCode(null);
                      setPriceCrossed(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void applyCode();
                      }
                    }}
                    placeholder={p.codePlaceholder}
                    className="w-full rounded-clay-md border-2 border-clay-borderLight bg-clay-cream px-3 py-2 text-sm font-bold uppercase text-clay-dark outline-none focus:border-clay-primary"
                  />
                  <button
                    onClick={() => void applyCode()}
                    disabled={validating || !discountCode.trim()}
                    className="shrink-0 rounded-clay-md bg-clay-primary px-4 py-2 text-sm font-extrabold text-white transition-colors hover:bg-clay-primaryDark disabled:opacity-50"
                  >
                    {validating ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      p.use
                    )}
                  </button>
                </div>
                <p className="mt-2 text-[11px] font-semibold text-clay-muted">
                  {p.codeHint.replace("{n}", "")}
                </p>
                {appliedCode?.free && appliedCode.remainingUses !== null && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-extrabold text-green-600">
                    <Zap size={12} /> {p.remainingQuota.replace("{n}", String(appliedCode.remainingUses))}
                  </p>
                )}
              </div>
            </div>

            {/* KANAN: benefit */}
            <div className="rounded-clay-md border-2 border-clay-borderLight bg-clay-cream p-6 shadow-clay-sm">
              <p className="flex items-center gap-2 text-lg font-extrabold text-clay-dark">
                {p.everything} <Crown size={20} className="text-clay-secondary" />
              </p>
              <ul className="mt-4 flex flex-col gap-3">
                {PERKS.map((perk) => (
                  <li key={perk} className="flex items-start gap-3">
                    <CheckCircle2
                      size={18}
                      className="mt-0.5 shrink-0 text-clay-success"
                    />
                    <span className="text-sm font-bold text-clay-dark">
                      {perk}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Daftar model AI — diturunkan dari katalog (sumber tunggal). */}
              <div className="mt-6 rounded-clay-md bg-clay-beige/60 px-4 py-4">
                <p className="flex items-center gap-2 text-sm font-extrabold text-clay-dark">
                  <Brain size={16} className="text-clay-primary" />
                  {p.modelsTitle}
                </p>
                <p className="mt-2 text-[11px] font-extrabold uppercase tracking-wide text-clay-muted">
                  {p.modelsFreeTitle}
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {FREE_MODELS.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center gap-1.5 rounded-clay-full bg-clay-cream px-2.5 py-1 text-[11px] font-bold text-clay-dark shadow-clay-sm"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.logo} alt="" className="h-3.5 w-3.5 rounded" />
                      {m.name}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-clay-muted">
                  <Crown size={12} className="text-clay-secondary" />
                  {p.modelsProTitle}
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {PRO_MODELS.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center gap-1.5 rounded-clay-full bg-clay-cream px-2.5 py-1 text-[11px] font-bold text-clay-dark shadow-clay-sm"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.logo} alt="" className="h-3.5 w-3.5 rounded" />
                      {m.name}
                      {!m.available && (
                        <span className="text-[9px] font-extrabold text-clay-muted">
                          {p.modelsSoon}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-2.5 text-[11px] font-semibold text-clay-muted">
                  {p.modelsNote}
                </p>
              </div>
              <div className="mt-6 flex items-start gap-2 rounded-clay-md bg-clay-beige/60 px-4 py-3 text-xs font-semibold text-clay-muted">
                <CreditCard size={15} className="mt-0.5 shrink-0" />
                <span>{p.payNote}</span>
              </div>
              <Link href="/dashboard" className="mt-4 block">
                <ButtonClay fullWidth variant="secondary">
                  {p.later}
                </ButtonClay>
              </Link>
            </div>
          </div>
        )}

        {/* ── Riwayat Pembelian (semua status: premium & non-premium) ── */}
        {isLoggedIn() && (
          <div className="mt-8 border-t-2 border-clay-shadow/30 pt-6">
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
      </CardClay>

      {/* Modal konfirmasi batalkan langganan (tanpa refund) */}
      {confirmCancel && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setConfirmCancel(false)}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-clay-cream p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle size={28} className="text-red-500" />
            </div>
            <h2 className="mt-4 text-xl font-extrabold text-clay-dark">
              {p.cancelTitle}
            </h2>
            <p className="mt-2 text-sm font-semibold text-clay-muted">
              {p.cancelDesc}
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                onClick={() => void cancelPlan()}
                disabled={cancelling}
                className="btn-clay-primary w-full py-3 text-base font-extrabold disabled:opacity-60"
              >
                {cancelling ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    {p.cancelling}
                  </span>
                ) : (
                  p.yesCancel
                )}
              </button>
              <button
                onClick={() => setConfirmCancel(false)}
                disabled={cancelling}
                className="w-full rounded-clay-md py-3 text-sm font-extrabold text-clay-muted transition-colors hover:bg-clay-beige disabled:opacity-60"
              >
                {p.notNow}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
