"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  Crown,
  FileText,
  Flame,
  MessageCircleQuestion,
  Rocket,
  Sparkles,
  Trophy,
  Upload,
  Users,
  Zap,
} from "lucide-react";

import { isLoggedIn } from "@/lib/auth";

const SITE_URL = "https://www.eureka-ai.web.id";

/* ── Copy SEO: kata kunci utama (AI tutor, catatan otomatis, kuis & kartu
   hafalan, belajar online, metode Socratic) tertanam wajar di setiap seksi. */

const FEATURES = [
  {
    icon: Brain,
    title: "AI Tutor Socratic",
    desc: "Eureka tidak memberi jawaban instan — ia membimbingmu dengan pertanyaan bertahap sampai kamu menemukan momen 'Eureka!' sendiri.",
  },
  {
    icon: FileText,
    title: "Catatan Otomatis dari Materi",
    desc: "Tempel link YouTube, artikel, atau unggah PDF — AI mengubahnya menjadi catatan belajar terstruktur per bab, siap dipelajari.",
  },
  {
    icon: MessageCircleQuestion,
    title: "Tanya Apa Saja per Bab",
    desc: "Kesulitan satu topik? Tanyakan langsung pada AI di bab tersebut — jawaban fokus pada materi yang sedang kamu pelajari.",
  },
  {
    icon: Users,
    title: "Belajar Bersama Teman",
    desc: "Kolaborasi real-time di catatan yang sama: chat, stabilo bersama, hingga papan tulis untuk belajar kelompok online.",
  },
  {
    icon: Zap,
    title: "Kuis & Kartu Hafalan",
    desc: "Setiap catatan otomatis dilengkapi kuis dan flashcards dari AI — berlatih tanpa perlu menyusun soal sendiri.",
  },
  {
    icon: Flame,
    title: "Streak, XP & Papan Peringkat",
    desc: "Belajar rutin menjaga streak tetap menyala. Naik level, kumpulkan XP, dan pantau progresmu di papan peringkat.",
  },
];

const STEPS = [
  {
    icon: Upload,
    title: "Masukkan Materi",
    desc: "Tempel link YouTube atau halaman web, atau unggah PDF/DOCX — apa pun sumber belajarmu.",
  },
  {
    icon: Sparkles,
    title: "AI Membuat Catatan",
    desc: "Materi diubah menjadi bab-bab rapi lengkap dengan ringkasan, poin penting, kuis, dan kartu hafalan.",
  },
  {
    icon: Brain,
    title: "Belajar Hingga Eureka!",
    desc: "Tanya pada AI per bab, kerjakan kuis, ulangi kartu hafalan — sampai benar-benar paham.",
  },
];

const FAQS = [
  {
    q: "Apa itu Eureka.AI?",
    a: "Eureka.AI adalah AI Tutor Socratic untuk pelajar Indonesia. Ia mengubah materi (video, artikel, PDF) menjadi catatan otomatis, lalu membimbingmu memahami konsep lewat pertanyaan bertahap — bukan sekadar memberi jawaban.",
  },
  {
    q: "Apakah Eureka.AI gratis?",
    a: "Ya. Paket Gratis tersedia selamanya: chat AI dengan batas harian, 3 catatan otomatis per bulan, serta kuis dan kartu hafalan dasar. Upgrade ke Pro (Rp 59.000/bulan) untuk akses tanpa batas.",
  },
  {
    q: "Bagaimana cara membuat catatan otomatis?",
    a: "Tempel link YouTube atau halaman web, atau unggah file PDF/DOCX di dashboard. AI merangkumnya menjadi catatan terstruktur per bab, lengkap dengan ringkasan, kuis, dan flashcards.",
  },
  {
    q: "Metode Socratic itu apa?",
    a: "Metode Socratic adalah cara belajar dengan pertanyaan bertahap: alih-alih langsung memberi jawaban, Eureka membimbingmu menemukan sendiri jawabannya sehingga pemahaman lebih dalam dan bertahan lama.",
  },
  {
    q: "Bisa belajar bersama teman?",
    a: "Bisa. Eureka.AI mendukung kolaborasi real-time pada catatan yang sama — chat, stabilo bersama, dan papan tulis — cocok untuk belajar kelompok online.",
  },
];

const AI_MODELS = [
  { name: "OpenAI", logo: "/images/ai-models/openai-color.svg" },
  { name: "Claude", logo: "/images/ai-models/claude-color.svg" },
  { name: "DeepSeek", logo: "/images/ai-models/deepseek-color.svg" },
  { name: "NVIDIA", logo: "/images/ai-models/nvidia-color.svg" },
];

export default function LandingPage() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
  }, []);

  // Data terstruktur untuk mesin pencari: Organization + SoftwareApplication
  // + FAQ (FAQPage). Dirender di dalam SSR HTML sehingga crawler membacanya.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Eureka.AI",
        url: SITE_URL,
        logo: `${SITE_URL}/logo.png`,
        description:
          "AI Tutor Socratic untuk pelajar Indonesia: catatan otomatis, kuis, dan kartu hafalan.",
        sameAs: [],
      },
      {
        "@type": "SoftwareApplication",
        name: "Eureka.AI",
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        url: SITE_URL,
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "IDR",
          lowPrice: "0",
          highPrice: "59000",
        },
        description:
          "AI Tutor Socratic untuk pelajar Indonesia: ubah video, artikel & PDF jadi catatan otomatis, tanya apa saja per bab, kerjakan kuis & kartu hafalan, dan belajar bersama teman.",
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  const ctaHref = loggedIn ? "/dashboard" : "/register";
  const ctaLabel = loggedIn ? "Lanjut Belajar" : "Mulai Gratis";

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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Logo Eureka.AI — AI Tutor Socratic"
              className="h-10 w-10 object-contain"
            />
            <span className="text-xl font-extrabold tracking-tight text-[#13102B]">
              Eureka<span className="text-[#7B42F5]">.AI</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-[15px] font-bold text-[#5A5670] md:flex">
            <a href="#fitur" className="transition-colors hover:text-[#7B42F5]">
              Fitur
            </a>
            <a
              href="#cara-kerja"
              className="transition-colors hover:text-[#7B42F5]"
            >
              Cara Kerja
            </a>
            <a href="#harga" className="transition-colors hover:text-[#7B42F5]">
              Harga
            </a>
            <a href="#faq" className="transition-colors hover:text-[#7B42F5]">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            {loggedIn ? (
              <Link href="/dashboard" className="k-btn-primary !min-h-[44px] !px-5 !py-2.5 text-sm">
                Buka Dashboard <ArrowRight size={16} className="ml-1" />
              </Link>
            ) : (
              <>
                <Link href="/login" className="k-btn-link hidden sm:inline-block">
                  Masuk
                </Link>
                <Link href="/register" className="k-btn-primary !min-h-[44px] !px-5 !py-2.5 text-sm">
                  Coba Gratis
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ──────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#7B42F5]/10" />
          <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#7B42F5]/10" />
          <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24">
            <span className="k-chip-outline">
              <Sparkles size={14} /> AI Tutor untuk Semua Pelajar Indonesia
            </span>
            <h1 className="mx-auto mt-7 max-w-4xl text-5xl font-extrabold leading-[1.05] tracking-[-0.03em] text-[#13102B] sm:text-6xl lg:text-[84px] lg:leading-[0.98]">
              Bukan sekadar jawaban, tapi momen{" "}
              <span className="text-[#7B42F5]">Eureka!</span>
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-lg font-normal leading-relaxed text-[#5A5670] sm:text-xl">
              Eureka.AI adalah AI Tutor Socratic untuk pelajar: ubah video,
              artikel &amp; PDF jadi catatan otomatis, tanya apa saja per bab,
              kerjakan kuis &amp; kartu hafalan — dan temukan sendiri jawabannya.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href={ctaHref} className="k-btn-primary">
                {ctaLabel} <ArrowRight size={18} />
              </Link>
              {!loggedIn && (
                <Link href="/pricing" className="k-btn-secondary">
                  Lihat Harga
                </Link>
              )}
            </div>
            <p className="mt-5 text-sm font-bold text-[#B9B6C7]">
              Gratis selamanya untuk fitur dasar — tanpa kartu kredit
            </p>

            {/* Visual mock catatan */}
            <div className="relative mx-auto mt-16 max-w-3xl">
              <div className="k-card rotate-[-2deg] text-left shadow-[0_18px_50px_rgba(19,16,43,0.12)]">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#7B42F5]/15 text-xl">
                    🎬
                  </span>
                  <div>
                    <p className="font-extrabold text-[#13102B]">
                      Turunan Fungsi — Konsep Dasar
                    </p>
                    <p className="text-xs font-bold text-[#B9B6C7]">
                      YouTube · 12 menit → catatan otomatis
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-2">
                  <div className="h-3 w-full rounded-full bg-[#E5E5E5]" />
                  <div className="h-3 w-5/6 rounded-full bg-[#E5E5E5]" />
                  <div className="h-3 w-4/6 rounded-full bg-[#E5E5E5]" />
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="k-chip !text-[11px]">Bab 1 · Limit</span>
                  <span className="rounded-full bg-[#13102B] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-white">
                    5 kuis siap
                  </span>
                </div>
              </div>
              <div className="k-card-accent absolute -bottom-8 -left-3 hidden rotate-[-5deg] !p-5 text-left shadow-[0_14px_40px_rgba(123,66,245,0.25)] sm:block">
                <p className="text-sm font-extrabold text-[#13102B]">
                  💬 Eureka: “Kalau kamu lari 5 km dalam 30 menit, berapa
                  kecepatan rata-ratamu?”
                </p>
                <p className="mt-2 text-xs font-bold text-[#B9B6C7]">
                  🤔 Siswa: “10 km/jam… Ooooh, itu turunan!”
                </p>
              </div>
              <div className="k-card absolute -right-3 -top-6 hidden rotate-[4deg] !p-4 shadow-[0_14px_40px_rgba(19,16,43,0.14)] sm:block">
                <p className="text-xs font-extrabold text-[#7B42F5]">
                  🔥 Streak 7 hari
                </p>
                <p className="text-sm font-extrabold text-[#13102B]">
                  Level 3 · 245 XP
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── AI Models ─────────────────────────────────────── */}
        <section className="border-t-2 border-[#E5E5E5] py-14">
          <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
            <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#B9B6C7]">
              Didukung oleh Model AI Terdepan
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#13102B]">
              Teknologi di balik Eureka.AI
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
              Sistem multi-model AI — otomatis memilih model terbaik untuk
              setiap tugas belajar
            </p>
          </div>
        </section>

        {/* ── Fitur ─────────────────────────────────────────── */}
        <section id="fitur" className="border-t-2 border-[#E5E5E5] py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#7B42F5]">
                Keunggulan Eureka.AI
              </p>
              <h2 className="mt-3 text-4xl font-extrabold leading-tight tracking-[-0.02em] text-[#13102B] sm:text-5xl">
                Belajar yang membuatmu paham, bukan sekadar hafal
              </h2>
              <p className="mt-4 text-lg text-[#5A5670]">
                Dari catatan otomatis sampai kuis interaktif — semua dirancang
                untuk pemahaman mendalam.
              </p>
            </div>
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="k-card transition-all duration-150 hover:-translate-y-1 hover:border-[#7B42F5] hover:shadow-[0_10px_0_rgba(123,66,245,0.12)]"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#7B42F5]/10">
                    <f.icon size={22} className="text-[#7B42F5]" />
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
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#7B42F5]">
                Cara Kerja
              </p>
              <h2 className="mt-3 text-4xl font-extrabold leading-tight tracking-[-0.02em] text-[#13102B] sm:text-5xl">
                Dari materi mentah hingga benar-benar paham
              </h2>
            </div>
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <div
                  key={s.title}
                  className="k-card flex flex-col items-center text-center"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#7B42F5]/10">
                    <s.icon size={26} className="text-[#7B42F5]" />
                  </span>
                  <span className="k-chip mt-5 !text-[11px]">
                    Langkah {i + 1}
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

        {/* ── Bukti Sosial ──────────────────────────────────── */}
        <section className="border-t-2 border-[#E5E5E5] py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="k-card flex flex-col items-center text-center">
                <Trophy size={24} className="text-[#7B42F5]" />
                <p className="mt-4 text-5xl font-extrabold tracking-tight text-[#13102B]">
                  60%+
                </p>
                <p className="mt-2 text-sm font-bold text-[#B9B6C7]">
                  rata-rata peningkatan pemahaman konsep dalam 2 minggu*
                </p>
              </div>
              <div className="k-card flex flex-col items-center text-center">
                <Flame size={24} className="text-[#7B42F5]" />
                <p className="mt-4 text-5xl font-extrabold tracking-tight text-[#13102B]">
                  7 hari
                </p>
                <p className="mt-2 text-sm font-bold text-[#B9B6C7]">
                  rata-rata streak belajar pengguna aktif
                </p>
              </div>
              <div className="k-card flex flex-col items-center text-center">
                <BookOpen size={24} className="text-[#7B42F5]" />
                <p className="mt-4 text-5xl font-extrabold tracking-tight text-[#13102B]">
                  100%
                </p>
                <p className="mt-2 text-sm font-bold text-[#B9B6C7]">
                  catatan dibuat AI — tinggal belajar, tanpa mencatat manual
                </p>
              </div>
            </div>
            <p className="mt-5 text-center text-xs font-bold text-[#B9B6C7]">
              *angka ilustrasi dari pengujian internal
            </p>
          </div>
        </section>

        {/* ── Harga ─────────────────────────────────────────── */}
        <section
          id="harga"
          className="border-t-2 border-[#E5E5E5] bg-[#FAF8FF] py-16 sm:py-24"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#7B42F5]">
                Harga
              </p>
              <h2 className="mt-3 text-4xl font-extrabold leading-tight tracking-[-0.02em] text-[#13102B] sm:text-5xl">
                Mulai gratis, upgrade kapan pun
              </h2>
              <p className="mt-4 text-lg text-[#5A5670]">
                Paket Pro Rp 59.000/bulan — bayar sekali, aktif 30 hari.
              </p>
            </div>
            <div className="mx-auto mt-14 grid max-w-3xl gap-6 sm:grid-cols-2">
              <div className="k-card flex flex-col">
                <p className="text-sm font-extrabold uppercase tracking-widest text-[#B9B6C7]">
                  Gratis
                </p>
                <p className="mt-3 text-5xl font-extrabold tracking-tight text-[#13102B]">
                  Rp 0
                  <span className="text-lg font-bold text-[#B9B6C7]">
                    /bulan
                  </span>
                </p>
                <ul className="mt-7 flex-1 space-y-3 text-sm font-semibold text-[#5A5670]">
                  <li className="flex items-center gap-2">
                    <Check size={16} className="shrink-0 text-[#7B42F5]" /> Chat
                    AI Socratic (batas harian)
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} className="shrink-0 text-[#7B42F5]" /> 3
                    catatan otomatis per bulan
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} className="shrink-0 text-[#7B42F5]" />{" "}
                    Kuis &amp; kartu hafalan dasar
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} className="shrink-0 text-[#7B42F5]" />{" "}
                    Streak, XP &amp; papan peringkat
                  </li>
                </ul>
                <Link
                  href="/register"
                  className="k-btn-secondary mt-8 w-full text-sm"
                >
                  Mulai Gratis
                </Link>
              </div>
              <div className="k-card-accent relative flex flex-col">
                <span className="k-chip absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  Terpopuler
                </span>
                <p className="text-sm font-extrabold uppercase tracking-widest text-[#7B42F5]">
                  Pro
                </p>
                <p className="mt-3 text-5xl font-extrabold tracking-tight text-[#13102B]">
                  Rp 59.000
                  <span className="text-lg font-bold text-[#B9B6C7]">
                    /bulan
                  </span>
                </p>
                <ul className="mt-7 flex-1 space-y-3 text-sm font-semibold text-[#5A5670]">
                  <li className="flex items-center gap-2">
                    <Check size={16} className="shrink-0 text-[#7B42F5]" />{" "}
                    Semua fitur paket Gratis
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} className="shrink-0 text-[#7B42F5]" /> Chat
                    AI tanpa batas
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} className="shrink-0 text-[#7B42F5]" />{" "}
                    Catatan otomatis tanpa batas
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} className="shrink-0 text-[#7B42F5]" />{" "}
                    Kolaborasi real-time dengan teman
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} className="shrink-0 text-[#7B42F5]" />{" "}
                    Akses fitur baru lebih dulu
                  </li>
                </ul>
                <Link
                  href="/pricing"
                  className="k-btn-primary mt-8 w-full text-sm"
                >
                  <Crown size={16} /> Berlangganan Pro
                </Link>
              </div>
            </div>
            <p className="mt-8 text-center text-sm font-bold text-[#B9B6C7]">
              💳 Pembayaran aman via Pakasir — QRIS, e-wallet, VA. Aktif otomatis
              setelah terverifikasi.
            </p>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────── */}
        <section id="faq" className="border-t-2 border-[#E5E5E5] py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="text-center">
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#7B42F5]">
                FAQ
              </p>
              <h2 className="mt-3 text-4xl font-extrabold tracking-[-0.02em] text-[#13102B]">
                Pertanyaan yang sering ditanyakan
              </h2>
            </div>
            <div className="mt-12 space-y-4">
              {FAQS.map((f) => (
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

        {/* ── CTA Akhir ─────────────────────────────────────── */}
        <section className="border-t-2 border-[#E5E5E5] px-4 pb-24 pt-4 sm:px-6">
          <div className="mx-auto max-w-4xl">
            <div className="k-card-accent flex flex-col items-center p-10 text-center sm:p-14">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#7B42F5]/10">
                <Rocket size={40} className="text-[#7B42F5]" />
              </span>
              <h2 className="mt-6 text-4xl font-extrabold leading-tight tracking-[-0.02em] text-[#13102B] sm:text-5xl">
                Siap mengalami momen Eureka pertamamu?
              </h2>
              <p className="mt-4 max-w-xl text-base font-medium text-[#5A5670] sm:text-lg">
                Mulai gratis sekarang, tempel materi pertamamu, dan biarkan AI
                membimbingmu hingga benar-benar paham — bukan sekadar menghafal.
              </p>
              <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                <Link href={ctaHref} className="k-btn-primary">
                  {ctaLabel} <ArrowRight size={18} />
                </Link>
                {!loggedIn && (
                  <Link href="/login" className="k-btn-secondary">
                    Saya sudah punya akun
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Logo Eureka.AI"
              className="h-8 w-8 object-contain"
            />
            <span className="text-lg font-extrabold text-[#13102B]">
              Eureka<span className="text-[#7B42F5]">.AI</span>
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm font-bold text-[#B9B6C7]">
            <a href="#fitur" className="transition-colors hover:text-[#7B42F5]">
              Fitur
            </a>
            <a
              href="#cara-kerja"
              className="transition-colors hover:text-[#7B42F5]"
            >
              Cara Kerja
            </a>
            <a href="#harga" className="transition-colors hover:text-[#7B42F5]">
              Harga
            </a>
            <a href="/pricing" className="transition-colors hover:text-[#7B42F5]">
              Pricing
            </a>
          </div>
          <p className="text-xs font-bold text-[#B9B6C7]">
            © {new Date().getFullYear()} Eureka.AI — AI Tutor Socratic untuk
            pelajar Indonesia
          </p>
        </div>
      </footer>
    </div>
  );
}
