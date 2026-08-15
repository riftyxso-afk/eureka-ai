"use client";

import { useState } from "react";
import Link from "next/link";
import { Crown, Loader2, Ticket, CheckCircle2, AlertTriangle } from "lucide-react";
import CardClay from "@/components/ui/CardClay";
import ButtonClay from "@/components/ui/ButtonClay";
import { useOnboarding } from "@/context/OnboardingContext";
import { usePremium } from "@/lib/usePremium";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { isLoggedIn, syncAuthSession } from "@/lib/auth";

const PERKS = [
  { icon: "♾️", text: "Sesi belajar & chat AI tak terbatas" },
  { icon: "🔍", text: "Web search real-time saat bertanya" },
  { icon: "🖼️", text: "Generate gambar AI (Eureka Draw)" },
  { icon: "🃏", text: "Kuis & flashcards AI tanpa batas" },
  { icon: "📚", text: "Generate catatan AI unlimited" },
  { icon: "✨", text: "Prioritas fitur baru" },
];

const TIERS = [
  {
    id: "normal" as const,
    name: "Pro Bulanan",
    price: 59000,
    note: "Harga normal",
    highlight: false,
  },
];

const TIER_LABEL: Record<string, string> = {
  promo: "Promo",
  normal: "Normal",
  trial: "Trial",
};

export default function PricingPage() {
  const { data } = useOnboarding();
  const { isPremium, tier, premiumUntil, loading, refresh } = usePremium();
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
        setError(body?.error ?? "Kode tidak valid.");
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
      setError(
        e instanceof Error ? e.message : "Gagal memvalidasi kode. Coba lagi ya 🙏"
      );
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
        setError("Silakan masuk dulu untuk berlangganan.");
        setBusy(null);
        window.location.href = "/login";
        return;
      }
      const userId = getUserId();
      if (!userId) {
        setError("Silakan masuk dulu untuk berlangganan.");
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
        setError(body?.error ?? "Gagal membuat pembayaran. Coba lagi ya 🙏");
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
      setError(
        e instanceof Error ? e.message : "Gagal membuat pembayaran. Coba lagi ya 🙏"
      );
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
        setError("Silakan masuk dulu untuk mencoba trial.");
        setClaimingTrial(false);
        window.location.href = "/login";
        return;
      }
      const userId = getUserId();
      if (!userId) {
        setError("Silakan masuk dulu untuk mencoba trial.");
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
        setError(body?.error ?? "Gagal mengaktifkan trial. Coba lagi ya 🙏");
        return;
      }
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Gagal mengaktifkan trial. Coba lagi ya 🙏"
      );
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
        setError("Silakan masuk dulu.");
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
        setError(body?.error ?? "Gagal membatalkan langganan. Coba lagi ya 🙏");
        setConfirmCancel(false);
        return;
      }
      setConfirmCancel(false);
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Gagal membatalkan langganan. Coba lagi ya 🙏"
      );
      setConfirmCancel(false);
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "";
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
          }),
        }}
      />
      <CardClay className="w-full max-w-5xl">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-clay-secondary shadow-clay-thumb">
            <Crown size={36} className="text-white" />
          </div>
          <h1 className="mt-5 text-3xl font-extrabold">
            {isPremium ? "Kamu Sudah Pro! 👑" : "Tingkatkan ke Pro"}
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-base font-semibold text-clay-muted">
            Harga Eureka.AI — AI Tutor Socratic untuk pelajar Indonesia. Mulai
            gratis selamanya, upgrade Pro untuk belajar tanpa batas.
          </p>
          <p className="mx-auto mt-1 max-w-xl text-base font-semibold text-clay-muted">
            {isPremium ? (
              <>
                Langganan aktif —{" "}
                <span className="font-extrabold text-clay-primary">
                  {TIER_LABEL[tier ?? ""] ?? "Pro"}
                </span>
                {premiumUntil && (
                  <>
                    {" "}hingga{" "}
                    <span className="font-extrabold">
                      {formatDate(premiumUntil)}
                    </span>
                  </>
                )}
                .
              </>
            ) : (
              <>
                {data.name ? `Halo, ${data.name.split(" ")[0]}! ` : ""}Dapatkan
                pengalaman belajar tanpa batas.
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
                Status langgananmu aktif 🎉
              </p>
              <p className="mt-1 text-sm font-semibold text-clay-dark">
                {tier === "trial"
                  ? "Kamu sedang dalam masa trial gratis. Semua fitur Pro terbuka!"
                  : "Semua fitur Pro sudah terbuka. Terima kasih sudah berlangganan!"}
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
                    Ke Pakasir…
                  </span>
                ) : (
                  "Top Up Pro (Perpanjang 30 Hari) 👑"
                )}
              </ButtonClay>
              <ButtonClay
                fullWidth
                variant="secondary"
                onClick={() => void refresh()}
              >
                Muat ulang status
              </ButtonClay>
              <Link href="/home">
                <ButtonClay fullWidth>Kembali ke Home</ButtonClay>
              </Link>
              {tier !== "trial" && (
                <button
                  onClick={() => {
                    setError(null);
                    setConfirmCancel(true);
                  }}
                  className="rounded-clay-md px-5 py-2.5 text-sm font-extrabold text-red-500 transition-colors hover:bg-red-50"
                >
                  Batalkan Langganan
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
                    <p className="text-base font-extrabold text-clay-primary">
                      🎁 Coba Gratis 7 Hari
                    </p>
                    <p className="mt-1 text-xs font-semibold text-clay-muted">
                      Semua fitur Pro tanpa bayar. Sekali seumur hidup, tanpa
                      kartu kredit.
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
                        Mengaktifkan…
                      </span>
                    ) : (
                      "Klaim Trial Gratis"
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
                      <p className="text-base font-extrabold">{t.name}</p>
                      {appliedCode?.free && (
                        <span className="rounded-full bg-green-500 px-2 py-0.5 text-[11px] font-extrabold text-white">
                          Gratis 100% 🎉
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
                      {appliedCode?.free ? appliedCode.label : t.note}
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
                          Ke Pakasir…
                        </span>
                      ) : appliedCode?.free ? (
                        "Klaim Gratis 🎉"
                      ) : (
                        `Pilih ${t.name}`
                      )}
                    </ButtonClay>
                  </div>
                ))}
              </div>

              {/* Kode diskon */}
              <div className="rounded-clay-md bg-clay-beige/70 px-5 py-4 text-left shadow-clay-sm">
                <label className="flex items-center gap-2 text-sm font-extrabold text-clay-dark">
                  <Ticket size={16} className="text-clay-primary" />
                  Punya kode diskon?
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
                    placeholder="MASUKKAN KODE (mis. GRATIS100)"
                    className="w-full rounded-clay-md border-2 border-clay-borderLight bg-white px-3 py-2 text-sm font-bold uppercase text-clay-dark outline-none focus:border-clay-primary"
                  />
                  <button
                    onClick={() => void applyCode()}
                    disabled={validating || !discountCode.trim()}
                    className="shrink-0 rounded-clay-md bg-clay-primary px-4 py-2 text-sm font-extrabold text-white transition-colors hover:bg-clay-primaryDark disabled:opacity-50"
                  >
                    {validating ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      "Pakai"
                    )}
                  </button>
                </div>
                <p className="mt-2 text-[11px] font-semibold text-clay-muted">
                  Tekan <b>Enter</b> atau tombol <b>Pakai</b> untuk menerapkan
                  kode sebelum memilih paket.
                </p>
                {appliedCode?.free && appliedCode.remainingUses !== null && (
                  <p className="mt-1.5 text-[11px] font-extrabold text-green-600">
                    ⚡ Sisa kuota {appliedCode.remainingUses} dari 10 orang.
                  </p>
                )}
              </div>
            </div>

            {/* KANAN: benefit */}
            <div className="rounded-clay-md border-2 border-clay-borderLight bg-white p-6 shadow-clay-sm">
              <p className="text-lg font-extrabold text-clay-dark">
                Semua yang kamu dapat 👑
              </p>
              <ul className="mt-4 flex flex-col gap-3">
                {PERKS.map((p) => (
                  <li key={p.text} className="flex items-start gap-3">
                    <CheckCircle2
                      size={18}
                      className="mt-0.5 shrink-0 text-clay-success"
                    />
                    <span className="text-sm font-bold text-clay-dark">
                      {p.text}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 rounded-clay-md bg-clay-beige/60 px-4 py-3 text-xs font-semibold text-clay-muted">
                💳 Pembayaran aman via <b>Pakasir</b> — QRIS, e-wallet, VA.
                Status premium aktif otomatis setelah pembayaran terverifikasi.
              </div>
              <Link href="/dashboard" className="mt-4 block">
                <ButtonClay fullWidth variant="secondary">
                  Nanti aja
                </ButtonClay>
              </Link>
            </div>
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
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle size={28} className="text-red-500" />
            </div>
            <h2 className="mt-4 text-xl font-extrabold text-clay-dark">
              Batalkan Langganan?
            </h2>
            <p className="mt-2 text-sm font-semibold text-clay-muted">
              Akses premium akan berhenti <b>sekarang</b>. Karena harga Pro
              sudah sangat murah, <b>tidak ada pengembalian dana (refund)</b>{" "}
              untuk sisa masa aktif.
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
                    Membatalkan…
                  </span>
                ) : (
                  "Ya, Batalkan Langganan"
                )}
              </button>
              <button
                onClick={() => setConfirmCancel(false)}
                disabled={cancelling}
                className="w-full rounded-clay-md py-3 text-sm font-extrabold text-clay-muted transition-colors hover:bg-clay-beige disabled:opacity-60"
              >
                Tidak jadi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
