"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  CreditCard,
  Crown,
  FileText,
  Flame,
  MessageCircle,
  MessageCircleQuestion,
  Rocket,
  Sparkles,
  SquarePlay,
  Trophy,
  Upload,
  Users,
  Zap,
} from "lucide-react";

import { isLoggedIn } from "@/lib/auth";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { useI18n } from "@/context/LocaleContext";
import {
  ReviewSection,
  type ReviewData,
} from "@/components/landing/ReviewSection";

const SITE_URL = "https://www.eureka-ai.web.id";

const AI_MODELS = [
  { name: "OpenAI", logo: "/images/ai-models/openai-color.svg" },
  { name: "Claude", logo: "/images/ai-models/claude-color.svg" },
  { name: "DeepSeek", logo: "/images/ai-models/deepseek-color.svg" },
  { name: "NVIDIA", logo: "/images/ai-models/nvidia-color.svg" },
];

export default function LandingPage() {
  const { locale, dict, setLocale } = useI18n();
  const [loggedIn, setLoggedIn] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);

  const loadReviews = useCallback(async () => {
    const userId = getUserId();
    const qs = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    try {
      const res = await apiFetch(`/api/reviews${qs}`);
      if (res.ok) setReviewData((await res.json()) as ReviewData);
    } catch {
      // biarkan null — seksi ulasan tidak tampil
    }
  }, []);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
    loadReviews();
  }, [loadReviews]);

  // Data terstruktur untuk mesin pencari & AI generatif: Organization +
  // WebSite + SoftwareApplication + FAQ (FAQPage). Dirender di dalam SSR
  // HTML sehingga crawler (Google, Bing, Perplexity, GPTBot, ClaudeBot)
  // membacanya. Bahasa mengikuti locale halaman.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Eureka.AI",
        url: SITE_URL,
        logo: `${SITE_URL}/logo.png`,
        description: dict.hero.subtitle,
        inLanguage: locale,
      },
      {
        "@type": "WebSite",
        name: "Eureka.AI",
        url: SITE_URL,
        inLanguage: locale,
      },
      {
        "@type": "SoftwareApplication",
        name: "Eureka.AI",
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        url: SITE_URL,
        inLanguage: locale,
        datePublished: "2026-08-15",
        dateModified: "2026-08-15",
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "IDR",
          lowPrice: "0",
          highPrice: "59000",
        },
        description: dict.hero.subtitle,
        // aggregateRating & review hanya diisi dengan data NYATA dari
        // tabel reviews (tidak pernah dipalsukan) — lihat ReviewSection.
        ...(reviewData?.stats && reviewData.stats.count > 0
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: String(reviewData.stats.average ?? 0),
                bestRating: "5",
                worstRating: "1",
                reviewCount: reviewData.stats.count,
              },
              review: (reviewData.reviews ?? []).slice(0, 3).map((r) => ({
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
      },
      {
        "@type": "FAQPage",
        mainEntity: dict.faq.items.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  const ctaHref = loggedIn ? "/dashboard" : "/register";
  const ctaLabel = loggedIn
    ? dict.nav.lanjutBelajar
    : dict.nav.mulaiGratis;

  return (
    <div className="k-landing min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Navbar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b-2 border-[#E5E5E5] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Logo Eureka.AI — AI Tutor Socratic"
              width={40}
              height={40}
              priority
              className="h-10 w-10 object-contain"
            />
            <span className="text-xl font-extrabold tracking-tight text-[#13102B]">
              Eureka<span className="text-[#7B42F5]">.AI</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-[15px] font-bold text-[#5A5670] md:flex">
            <a href="#fitur" className="transition-colors hover:text-[#7B42F5]">
              {dict.nav.fitur}
            </a>
            <a
              href="#cara-kerja"
              className="transition-colors hover:text-[#7B42F5]"
            >
              {dict.nav.caraKerja}
            </a>
            <a href="#harga" className="transition-colors hover:text-[#7B42F5]">
              {dict.nav.harga}
            </a>
            <a href="#faq" className="transition-colors hover:text-[#7B42F5]">
              {dict.nav.faq}
            </a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Pemilih bahasa */}
            <div className="flex items-center gap-0.5 rounded-full border-2 border-[#E5E5E5] p-0.5 text-xs font-extrabold">
              {(["id", "en"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => l !== locale && setLocale(l)}
                  className={`rounded-full px-2.5 py-1 uppercase transition-colors ${
                    locale === l
                      ? "bg-[#7B42F5] text-white"
                      : "text-[#B9B6C7] hover:text-[#7B42F5]"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            {loggedIn ? (
              <Link href="/dashboard" className="k-btn-primary !min-h-[44px] !px-5 !py-2.5 text-sm">
                {dict.nav.bukaDashboard} <ArrowRight size={16} className="ml-1" />
              </Link>
            ) : (
              <>
                <Link href="/login" className="k-btn-link hidden sm:inline-block">
                  {dict.nav.masuk}
                </Link>
                <Link href="/register" className="k-btn-primary !min-h-[44px] !px-5 !py-2.5 text-sm">
                  {dict.nav.cobaGratis}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ──────────────────────────────────────────── */}
        <section className="relative overflow-hidden" aria-label="Eureka.AI — AI tutor Socratic untuk pelajar Indonesia">
          <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#7B42F5]/10" />
          <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#7B42F5]/10" />
          <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24">
            <span className="k-chip-outline">
              <Sparkles size={14} /> {dict.hero.chip}
            </span>
            <h1 className="mx-auto mt-7 max-w-4xl text-5xl font-extrabold leading-[1.05] tracking-[-0.03em] text-[#13102B] sm:text-6xl lg:text-[84px] lg:leading-[0.98]">
              {dict.hero.title1}{" "}
              <span className="text-[#7B42F5]">{dict.hero.title2}</span>
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-lg font-normal leading-relaxed text-[#5A5670] sm:text-xl">
              {dict.hero.subtitle}
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href={ctaHref} className="k-btn-primary">
                {ctaLabel} <ArrowRight size={18} />
              </Link>
              {!loggedIn && (
                <Link href="/pricing" className="k-btn-secondary">
                  {dict.nav.lihatHarga}
                </Link>
              )}
            </div>
            <p className="mt-5 text-sm font-bold text-[#B9B6C7]">
              {dict.hero.gratis}
            </p>

            {/* Visual mock catatan */}
            <div className="relative mx-auto mt-16 max-w-3xl">
              <div className="k-card rotate-[-2deg] text-left shadow-[0_18px_50px_rgba(19,16,43,0.12)]">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#7B42F5]/15 text-[#7B42F5]">
                    <SquarePlay size={22} />
                  </span>
                  <div>
                    <p className="font-extrabold text-[#13102B]">
                      {dict.hero.noteTitle}
                    </p>
                    <p className="text-xs font-bold text-[#B9B6C7]">
                      {dict.hero.noteMeta}
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-2">
                  <div className="h-3 w-full rounded-full bg-[#E5E5E5]" />
                  <div className="h-3 w-5/6 rounded-full bg-[#E5E5E5]" />
                  <div className="h-3 w-4/6 rounded-full bg-[#E5E5E5]" />
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="k-chip !text-[11px]">{dict.hero.noteBab}</span>
                  <span className="rounded-full bg-[#13102B] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-white">
                    {dict.hero.noteQuiz}
                  </span>
                </div>
              </div>
              <div className="k-card-accent absolute -bottom-8 -left-3 hidden rotate-[-5deg] !p-5 text-left shadow-[0_14px_40px_rgba(123,66,245,0.25)] sm:block">
                <p className="text-sm font-extrabold text-[#13102B]">
                  <MessageCircle size={15} className="-mt-0.5 mr-1.5 inline text-[#7B42F5]" />
                  {dict.hero.chatEureka}
                </p>
                <p className="mt-2 text-xs font-bold text-[#B9B6C7]">
                  <MessageCircleQuestion size={14} className="-mt-0.5 mr-1.5 inline" />
                  {dict.hero.chatSiswa}
                </p>
              </div>
              <div className="k-card absolute -right-3 -top-6 hidden rotate-[4deg] !p-4 shadow-[0_14px_40px_rgba(19,16,43,0.14)] sm:block">
                <p className="flex items-center gap-1.5 text-xs font-extrabold text-[#7B42F5]">
                  <Flame size={14} /> {dict.hero.streak}
                </p>
                <p className="text-sm font-extrabold text-[#13102B]">
                  {dict.hero.level}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── AI Models ─────────────────────────────────────── */}
        <section className="border-t-2 border-[#E5E5E5] py-14" aria-label="Teknologi AI di balik Eureka.AI">
          <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
            <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#B9B6C7]">
              {dict.aiModels.label}
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#13102B]">
              {dict.aiModels.title}
            </h2>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-8 sm:gap-12">
              {AI_MODELS.map((model) => (
                <div
                  key={model.name}
                  className="group flex flex-col items-center gap-2"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-[#E5E5E5] bg-white shadow-[0_4px_0_#E5E5E5] transition-transform duration-150 group-hover:-translate-y-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={model.logo} alt={model.name} className="h-8 w-8" />
                  </div>
                  <span className="text-xs font-extrabold text-[#B9B6C7]">
                    {model.name}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-7 text-sm font-bold text-[#B9B6C7]">
              {dict.aiModels.desc}
            </p>
          </div>
        </section>

        {/* ── Fitur ─────────────────────────────────────────── */}
        <section
          id="fitur"
          className="border-t-2 border-[#E5E5E5] py-16 sm:py-24"
          aria-label="Fitur Eureka.AI"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#7B42F5]">
                {dict.fitur.label}
              </p>
              <h2 className="mt-3 text-4xl font-extrabold leading-tight tracking-[-0.02em] text-[#13102B] sm:text-5xl">
                {dict.fitur.title}
              </h2>
              <p className="mt-4 text-lg text-[#5A5670]">
                {dict.fitur.desc}
              </p>
            </div>
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {dict.fitur.items.map((f, i) => (
                <div
                  key={i}
                  className="k-card transition-all duration-150 hover:-translate-y-1 hover:border-[#7B42F5] hover:shadow-[0_10px_0_rgba(123,66,245,0.12)]"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#7B42F5]/10">
                    {(() => {
                      const Icon = FEATURE_ICONS[i] ?? Brain;
                      return <Icon size={22} className="text-[#7B42F5]" />;
                    })()}
                  </span>
                  <h3 className="mt-5 text-lg font-extrabold text-[#13102B]">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-[#5A5670]">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Cara Kerja ────────────────────────────────────── */}
        <section
          id="cara-kerja"
          className="border-t-2 border-[#E5E5E5] bg-[#FAF8FF] py-16 sm:py-24"
          aria-label="Cara kerja Eureka.AI"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#7B42F5]">
                {dict.caraKerja.label}
              </p>
              <h2 className="mt-3 text-4xl font-extrabold leading-tight tracking-[-0.02em] text-[#13102B] sm:text-5xl">
                {dict.caraKerja.title}
              </h2>
              <p className="mt-4 text-lg text-[#5A5670]">
                {dict.caraKerja.desc}
              </p>
            </div>
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {dict.caraKerja.steps.map((s, i) => (
                <div
                  key={i}
                  className="k-card flex flex-col items-center text-center"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#7B42F5]/10">
                    {(() => {
                      const Icon = STEP_ICONS[i] ?? Brain;
                      return <Icon size={26} className="text-[#7B42F5]" />;
                    })()}
                  </span>
                  <span className="k-chip mt-5 !text-[11px]">
                    {dict.caraKerja.langkah} {i + 1}
                  </span>
                  <h3 className="mt-4 text-lg font-extrabold text-[#13102B]">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-[#5A5670]">
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Fakta Eureka.AI (GEO — angka yang bisa dikutip AI) ── */}
        <section
          className="border-t-2 border-[#E5E5E5] py-16"
          aria-label="Fakta Eureka.AI"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#7B42F5]">
                {dict.fakta.label}
              </p>
              <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-[#13102B]">
                {dict.fakta.title}
              </h2>
              <p className="mt-4 text-lg text-[#5A5670]">
                {dict.fakta.desc}
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              <div className="k-card flex flex-col items-center text-center">
                <Trophy size={24} className="text-[#7B42F5]" />
                <p className="mt-4 text-5xl font-extrabold tracking-tight text-[#13102B]">
                  4
                </p>
                <p className="mt-2 text-sm font-bold text-[#B9B6C7]">
                  {dict.fakta.stat1}
                </p>
              </div>
              <div className="k-card flex flex-col items-center text-center">
                <Flame size={24} className="text-[#7B42F5]" />
                <p className="mt-4 text-5xl font-extrabold tracking-tight text-[#13102B]">
                  30
                </p>
                <p className="mt-2 text-sm font-bold text-[#B9B6C7]">
                  {dict.fakta.stat2}
                </p>
              </div>
              <div className="k-card flex flex-col items-center text-center">
                <BookOpen size={24} className="text-[#7B42F5]" />
                <p className="mt-4 text-5xl font-extrabold tracking-tight text-[#13102B]">
                  3
                </p>
                <p className="mt-2 text-sm font-bold text-[#B9B6C7]">
                  {dict.fakta.stat3}
                </p>
              </div>
            </div>
            <p className="mt-5 text-center text-xs font-bold text-[#B9B6C7]">
              {dict.fakta.updated}
            </p>
          </div>
        </section>

        {/* ── Harga ─────────────────────────────────────────── */}
        <section
          id="harga"
          className="border-t-2 border-[#E5E5E5] bg-[#FAF8FF] py-16 sm:py-24"
          aria-label="Harga Eureka.AI"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#7B42F5]">
                {dict.harga.label}
              </p>
              <h2 className="mt-3 text-4xl font-extrabold leading-tight tracking-[-0.02em] text-[#13102B] sm:text-5xl">
                {dict.harga.title}
              </h2>
              <p className="mt-4 text-lg text-[#5A5670]">
                {dict.harga.desc}
              </p>
            </div>
            <div className="mx-auto mt-14 grid max-w-3xl gap-6 sm:grid-cols-2">
              <div className="k-card flex flex-col">
                <p className="text-sm font-extrabold uppercase tracking-widest text-[#B9B6C7]">
                  {dict.harga.gratis}
                </p>
                <p className="mt-3 text-5xl font-extrabold tracking-tight text-[#13102B]">
                  Rp 0
                  <span className="text-lg font-bold text-[#B9B6C7]">
                    {dict.harga.perBulan}
                  </span>
                </p>
                <ul className="mt-7 flex-1 space-y-3 text-sm font-semibold text-[#5A5670]">
                  {dict.harga.gratisFeatures.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check size={16} className="shrink-0 text-[#7B42F5]" /> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="k-btn-secondary mt-8 w-full text-sm"
                >
                  {dict.nav.mulaiGratis}
                </Link>
              </div>
              <div className="k-card-accent relative flex flex-col">
                <span className="k-chip absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  {dict.harga.terpopuler}
                </span>
                <p className="text-sm font-extrabold uppercase tracking-widest text-[#7B42F5]">
                  {dict.harga.pro}
                </p>
                <p className="mt-3 text-5xl font-extrabold tracking-tight text-[#13102B]">
                  Rp 59.000
                  <span className="text-lg font-bold text-[#B9B6C7]">
                    {dict.harga.perBulan}
                  </span>
                </p>
                <ul className="mt-7 flex-1 space-y-3 text-sm font-semibold text-[#5A5670]">
                  {dict.harga.proFeatures.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check size={16} className="shrink-0 text-[#7B42F5]" /> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/pricing"
                  className="k-btn-primary mt-8 w-full text-sm"
                >
                  <Crown size={16} /> {dict.harga.berlangganan}
                </Link>
              </div>
            </div>
            <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-sm font-bold text-[#B9B6C7]">
              <CreditCard size={15} /> {dict.harga.pembayaran}
            </p>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────── */}
        <section
          id="faq"
          className="border-t-2 border-[#E5E5E5] py-16 sm:py-24"
          aria-label="Pertanyaan yang sering ditanyakan tentang Eureka.AI"
        >
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="text-center">
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#7B42F5]">
                {dict.faq.label}
              </p>
              <h2 className="mt-3 text-4xl font-extrabold tracking-[-0.02em] text-[#13102B]">
                {dict.faq.title}
              </h2>
            </div>
            <div className="mt-12 space-y-4">
              {dict.faq.items.map((f) => (
                <details
                  key={f.q}
                  className="k-card group !p-6 open:border-[#7B42F5]"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-extrabold text-[#13102B] [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span className="text-[#7B42F5] transition-transform duration-200 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-4 text-sm font-medium leading-relaxed text-[#5A5670]">
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Ulasan Pengguna (bukti sosial nyata → JSON-LD) ── */}
        <ReviewSection
          data={reviewData}
          loggedIn={loggedIn}
          onRefresh={loadReviews}
        />

        {/* ── CTA Akhir ─────────────────────────────────────── */}
        <section className="border-t-2 border-[#E5E5E5] px-4 pb-24 pt-4 sm:px-6">
          <div className="mx-auto max-w-4xl">
            <div className="k-card-accent flex flex-col items-center p-10 text-center sm:p-14">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#7B42F5]/10">
                <Rocket size={40} className="text-[#7B42F5]" />
              </span>
              <h2 className="mt-6 text-4xl font-extrabold leading-tight tracking-[-0.02em] text-[#13102B] sm:text-5xl">
                {dict.ctaAkhir.title}
              </h2>
              <p className="mt-4 max-w-xl text-base font-medium text-[#5A5670] sm:text-lg">
                {dict.ctaAkhir.desc}
              </p>
              <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                <Link href={ctaHref} className="k-btn-primary">
                  {ctaLabel} <ArrowRight size={18} />
                </Link>
                {!loggedIn && (
                  <Link href="/login" className="k-btn-secondary">
                    {dict.nav.sayaSudahPunyaAkun}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t-2 border-[#E5E5E5] py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Logo Eureka.AI"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
            <span className="text-lg font-extrabold text-[#13102B]">
              Eureka<span className="text-[#7B42F5]">.AI</span>
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm font-bold text-[#B9B6C7]">
            <a href="#fitur" className="transition-colors hover:text-[#7B42F5]">
              {dict.nav.fitur}
            </a>
            <a
              href="#cara-kerja"
              className="transition-colors hover:text-[#7B42F5]"
            >
              {dict.nav.caraKerja}
            </a>
            <a href="#harga" className="transition-colors hover:text-[#7B42F5]">
              {dict.nav.harga}
            </a>
            <a href="/pricing" className="transition-colors hover:text-[#7B42F5]">
              {dict.nav.pricing}
            </a>
            <a href="/join" className="transition-colors hover:text-[#7B42F5]">
              {dict.nav.beta}
            </a>
          </div>
          <p className="text-xs font-bold text-[#B9B6C7]">
            © {new Date().getFullYear()} Eureka.AI — {dict.footer.copyright}
          </p>
        </div>
        {/* Badge Featured Product Hunt */}
        <div className="mt-8 flex justify-center">
          <a
            href="https://www.producthunt.com/products/eureka-ai-socratic-ai-study-tutor?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-eureka-ai-socratic-ai-study-tutor"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              alt="Eureka.AI — Socratic AI Study Tutor - AI Socratic tutor that turns videos & PDFs into study notes | Product Hunt"
              width={250}
              height={54}
              src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1225609&theme=light&t=1787036631696"
            />
          </a>
        </div>
      </footer>
    </div>
  );
}

/* Ikon fitur & langkah — tetap di sini agar komponen ringan. */
const FEATURE_ICONS = [
  Brain,
  FileText,
  MessageCircleQuestion,
  Users,
  Zap,
  Flame,
];
const STEP_ICONS = [Upload, Sparkles, Brain];
