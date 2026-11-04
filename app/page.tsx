"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

import { isLoggedIn } from "@/lib/auth";
import { useI18n } from "@/context/LocaleContext";

const SITE_URL = "https://www.eureka-ai.web.id";

export default function LandingPage() {
  const { locale, dict, setLocale } = useI18n();
  const [loggedIn, setLoggedIn] = useState(false);
  const [playHero, setPlayHero] = useState(false);
  const [heroVideoFailed, setHeroVideoFailed] = useState(false);
  const [playingBenefits, setPlayingBenefits] = useState<string[]>([]);
  useEffect(() => { setLoggedIn(isLoggedIn()); }, []);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const syncMotion = () => {
      setPlayHero(motion.matches);
      setHeroVideoFailed(false);
    };
    syncMotion();
    motion.addEventListener("change", syncMotion);
    return () => motion.removeEventListener("change", syncMotion);
  }, []);

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
      },
    ],
  };

  const ctaHref = loggedIn ? "/dashboard" : "/register";
  const ctaLabel = loggedIn
    ? dict.nav.lanjutBelajar
    : locale === "en" ? "Start learning for free" : "Mulai belajar gratis";

  const buttonBase = "landing-press inline-flex min-h-[50px] w-full items-center justify-center rounded-xl px-4 py-2 text-center text-sm font-black uppercase tracking-[0.6px]";
  const primaryButton = `${buttonBase} border-b-4 border-[#512597] bg-[#7540D0] text-white`;

  const en = locale === "en";
  const benefits = [
    ["Hp24z", "gratis. seru. bikin paham.", "free. fun. made for learning.", "Ubah materi menjadi catatan, tanyakan bagian yang membingungkan, lalu latih pemahamanmu sedikit demi sedikit.", "Turn material into notes, ask about tricky parts, and practice at your own pace."],
    ["zw3g9", "teman berpikir, bukan sekadar jawaban.", "a partner to think with.", "Tanyakan pada Eureka dan pahami materi lewat penjelasan sederhana, langkah demi langkah.", "Ask Eureka and work through simple explanations, one step at a time."],
    ["ei6Qn", "semangat belajar, setiap hari.", "keep showing up for yourself.", "Bangun kebiasaan belajar dengan kuis, flashcard, dan jadwalmu sendiri.", "Build a study habit with quizzes, flashcards, and your own schedule."],
    ["QxOnt", "belajarmu, caramu.", "your learning, your way.", "Mulai dari materi yang ingin kamu kuasai. Rangkum, bertanya, dan berlatih sesuai ritmemu.", "Start with the material you want to master. Summarize, ask, and practice at your pace."],
  ];
  const benefitVideos: Record<string, string> = {
    Hp24z: "/landing/learning.mp4",
    zw3g9: "/landing/tutor.mp4",
    ei6Qn: "/landing/motivation.mp4",
  };

  return (
    <div className="k-landing [color-scheme:light]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <header>
        <div className="mx-auto flex min-h-[70px] max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-3">
          <Link href="/" className="text-3xl font-black tracking-tight text-[#7540D0]">eureka!</Link>
          <nav aria-label={en ? "Main navigation" : "Navigasi utama"} className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-bold">
            <a href="#fitur">{en ? "Features" : "Fitur"}</a>
            <Link href="/pricing">{en ? "Pricing" : "Harga"}</Link>
            <select aria-label={en ? "Site language" : "Bahasa situs"} value={locale} onChange={(event) => setLocale(event.target.value === "en" ? "en" : "id")} className="rounded-lg bg-transparent p-2">
              <option value="id">Indonesia</option>
              <option value="en">English</option>
            </select>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid min-h-[calc(100svh-70px)] max-w-5xl content-center items-center gap-6 px-6 py-10 text-center sm:py-14 md:grid-cols-2 md:gap-12">
          <div className="relative mx-auto aspect-square w-full max-w-[360px] md:max-w-[424px]">
            <Image src="/landing/BtO1T.png" alt="" unoptimized loading="eager" width={424} height={424} className={`h-auto w-full ${heroVideoFailed ? "" : "hidden motion-reduce:block"}`} />
            {playHero && !heroVideoFailed && (
              <video
                src="/landing/hero-motion.mp4"
                aria-hidden="true"
                autoPlay
                muted
                playsInline
                className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-contain"
                onEnded={(event) => {
                  const video = event.currentTarget;
                  // This frame is after the phone sequence and closely matches the ending.
                  video.currentTime = 5.708;
                  void video.play().catch(() => {});
                }}
                onError={() => setHeroVideoFailed(true)}
              />
            )}
          </div>
          <div>
            <h1 className="mx-auto max-w-md text-balance text-3xl font-black leading-tight sm:text-4xl">
              {en ? "A fun way to learn and understand anything!" : "Cara paling seru untuk belajar dan memahami apa saja!"}
            </h1>
            <div className="mx-auto mt-8 grid max-w-[330px] gap-3">
              <Link href={ctaHref} className={primaryButton}>{ctaLabel}</Link>
              {!loggedIn && <Link href="/login" className={`${buttonBase} border-2 border-b-4 border-[#E5E5E5] bg-[#FFFFFF] text-[#7038C8]`}>{en ? "I already have an account" : "Aku sudah punya akun"}</Link>}
            </div>
          </div>
        </section>

        <ul className="flex flex-wrap justify-center gap-x-10 gap-y-3 px-6 py-5 text-sm font-extrabold uppercase text-[#7540D0]">
          {(en ? ["Notes", "Ask AI", "Quizzes", "Schedule", "Streak"] : ["Catatan", "Tanya AI", "Kuis", "Jadwal", "Streak"]).map((topic) => <li key={topic}>{topic}</li>)}
        </ul>

        <div id="fitur" className="mx-auto max-w-5xl px-6">
          {benefits.map(([asset, title, englishTitle, description, englishDescription], index) => (
            <section key={asset} className="grid min-h-svh content-center items-center gap-6 py-12 text-center md:grid-cols-2 md:gap-[50px] md:text-left">
              <div className={index % 2 ? "md:order-2" : ""}>
                <h2 className="text-3xl font-black leading-tight text-[#7540D0] sm:text-4xl">{en ? englishTitle : title}</h2>
                <p className="mt-4 text-base leading-relaxed sm:text-lg">{en ? englishDescription : description}</p>
              </div>
              <div className="relative mx-auto w-full max-w-[480px]">
                <Image src={`/landing/${asset}.png`} alt="" unoptimized width={480} height={530} className={`h-auto w-full ${playHero && playingBenefits.includes(asset) ? "invisible" : ""}`} />
                {playHero && benefitVideos[asset] && (
                  <video
                    src={benefitVideos[asset]}
                    aria-hidden="true"
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="none"
                    className={`pointer-events-none absolute inset-0 h-full w-full object-contain ${playingBenefits.includes(asset) ? "opacity-100" : "opacity-0"}`}
                    onPlaying={() => setPlayingBenefits((current) => current.includes(asset) ? current : [...current, asset])}
                    onError={() => setPlayingBenefits((current) => current.filter((item) => item !== asset))}
                  />
                )}
              </div>
            </section>
          ))}
        </div>

        <section id="aplikasi" className="relative isolate flex min-h-svh flex-col items-center justify-center overflow-hidden text-center">
          <Image src="/landing/T9eUJp.png" alt="" unoptimized width={1663} height={1289} className="mx-auto max-h-[72svh] w-full max-w-[1663px] object-contain" />
          <div className="order-first mx-auto max-w-xl px-6 pt-12">
            <h2 className="text-xl font-black leading-tight text-[#241751] sm:text-4xl">{en ? "learn anytime, anywhere." : "belajar kapan saja, di mana saja."}</h2>
            <p className="mt-2 text-sm font-bold sm:text-base">{en ? "Coming soon to Google Play for Android." : "Segera rilis di Google Play untuk Android."}</p>
            <div className="mt-5 inline-flex items-center gap-3 rounded-xl bg-[#17113F] px-4 py-3 text-left text-white">
              <svg aria-hidden="true" viewBox="0 0 24 24" width="26" height="26">
                <path fill="#32BBF5" d="M3.6 2.2a1.7 1.7 0 0 0-.6 1.3v17a1.7 1.7 0 0 0 .6 1.3l9.8-9.8z" />
                <path fill="#00D775" d="M3.6 2.2a1.5 1.5 0 0 1 1.8-.1l11.3 6.4-3.3 3.5z" />
                <path fill="#FFCF47" d="m16.7 8.5 3.8 2.1a1.6 1.6 0 0 1 0 2.8l-3.8 2.1-3.3-3.5z" />
                <path fill="#FF5266" d="M3.6 21.8a1.5 1.5 0 0 0 1.8.1l11.3-6.4-3.3-3.5z" />
              </svg>
              <span className="leading-tight">
                <span className="block text-xs font-bold">{en ? "Coming soon to" : "Segera rilis di"}</span>
                <span className="block text-lg font-extrabold">Google Play</span>
              </span>
            </div>
          </div>
        </section>

        <section className="bg-[#17113F] text-white">
          <div className="mx-auto grid min-h-svh max-w-5xl content-center items-center gap-8 px-6 py-14 text-center md:grid-cols-2 md:text-left">
            <Image src="/landing/meKer.png" alt="" unoptimized width={424} height={424} className="mx-auto w-full max-w-[480px]" />
            <div>
              <p className="mb-6 text-5xl font-black text-[#C4A5FF] sm:text-[64px]">eureka!</p>
              <h2 className="text-3xl font-black sm:text-[40px]">{en ? "Your curiosity has a friend." : "Rasa penasaranmu punya teman."}</h2>
              <p className="my-5 text-violet-100">{en ? "Bring your material. Ask about what you don’t understand. Find your Eureka moment." : "Bawa materimu. Tanyakan yang belum kamu pahami. Temukan momen “oh, begitu!” bersama Eureka."}</p>
              <Link href={ctaHref} className={`${primaryButton} max-w-[330px]`}>{ctaLabel}</Link>
            </div>
          </div>
        </section>


        <section className="flex min-h-svh flex-col items-center justify-end pt-12 text-center">
          <h2 className="mx-auto max-w-lg px-6 text-3xl font-black text-[#7540D0] sm:text-5xl">{en ? "Make learning fun with Eureka!" : "Belajar jadi seru bersama Eureka!"}</h2>
          <Link href={ctaHref} className={`${primaryButton} mx-auto mt-6 max-w-[330px]`}>{ctaLabel}</Link>
          <Image src="/landing/B6jnFE.png" alt="" unoptimized width={1663} height={590} className="mt-8 h-auto max-h-[70svh] w-full object-cover" />
        </section>
      </main>

      <footer className="bg-gradient-to-b from-[#7540D0] to-[#54269C] text-white">
        <div className="mx-auto grid max-w-5xl gap-8 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="text-3xl font-black">eureka!</Link>
            <p className="mt-3 text-sm text-violet-100">{en ? "A study buddy for every curious mind." : "Teman belajar untuk setiap rasa ingin tahu."}</p>
          </div>
          <div className="grid content-start gap-3 text-sm">
            <h2 className="font-black">{en ? "Product" : "Produk"}</h2>
            <a href="#fitur">{en ? "Study tools" : "Fitur belajar"}</a>
            <Link href="/pricing">{en ? "Pricing" : "Harga"}</Link>
          </div>
          <div className="grid content-start gap-3 text-sm">
            <h2 className="font-black">{en ? "App" : "Aplikasi"}</h2>
            <a href="#aplikasi">Eureka untuk Android</a>
          </div>
          <div className="grid content-start gap-3 text-sm">
            <h2 className="font-black">{en ? "Help" : "Bantuan"}</h2>
            <Link href="/join">{en ? "Join Eureka" : "Gabung Eureka"}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
