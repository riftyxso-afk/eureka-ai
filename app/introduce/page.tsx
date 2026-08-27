"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Home, PlayCircle } from "lucide-react";
import CardClay from "@/components/ui/CardClay";
import ButtonClay from "@/components/ui/ButtonClay";
import { useI18n } from "@/context/LocaleContext";

type VideoLang = "id" | "en";

const VIDEO_URLS: Record<VideoLang, string> = {
  id: "https://drive.google.com/file/d/1Bp5N0X4FtsmOsE-yPf8cEv-rlKmgy1f9/preview",
  en: "https://drive.google.com/file/d/1783QcIB-X4wZtjPCxu4v-OKd-1RZucTC/preview",
};

const STORAGE_KEY = "eureka_intro_video_lang";

export default function IntroducePage() {
  const { locale, dict } = useI18n();
  const l = dict.introduce;
  const [lang, setLang] = useState<VideoLang>(locale === "en" ? "en" : "id");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "id" || saved === "en") setLang(saved);
    } catch {
      // abaikan — fallback ke locale halaman
    }
  }, []);

  const choose = (next: VideoLang) => {
    setLang(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // abaikan
    }
  };

  return (
    <main className="min-h-screen bg-clay-beige px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-clay-full bg-clay-primary/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-clay-primary">
            <PlayCircle size={12} /> {l.chip}
          </span>
          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">{l.title}</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm font-semibold text-clay-muted sm:text-base">
            {l.subtitle}
          </p>
        </div>

        {/* Pemilih bahasa video */}
        <div className="mb-6 flex justify-center">
          <CardClay className="flex items-center gap-1 p-1.5">
            {(
              [
                { key: "id", label: l.videoId },
                { key: "en", label: l.videoEn },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => choose(opt.key)}
                className={`rounded-clay-full px-4 py-2 text-sm font-extrabold transition sm:px-6 ${
                  lang === opt.key
                    ? "bg-clay-primary text-white shadow-[0_3px_0_#5B21B6]"
                    : "bg-transparent text-clay-muted hover:text-clay-primary"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </CardClay>
        </div>

        {/* Video */}
        <CardClay className="overflow-hidden p-2 sm:p-3">
          <div className="relative aspect-video w-full overflow-hidden rounded-clay-md">
            <iframe
              key={lang}
              src={VIDEO_URLS[lang]}
              title={lang === "id" ? l.videoId : l.videoEn}
              className="absolute inset-0 h-full w-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        </CardClay>

        {/* Aksi */}
        <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
          <Link href="/dashboard">
            <ButtonClay className="w-full sm:w-auto">{l.mulaiBelajar}</ButtonClay>
          </Link>
          <Link href="/">
            <ButtonClay variant="secondary" className="w-full sm:w-auto">
              <span className="inline-flex items-center gap-2">
                <Home size={18} /> {l.keBeranda}
              </span>
            </ButtonClay>
          </Link>
        </div>

        <p className="mt-8 text-center text-xs font-semibold text-clay-muted">
          {l.watchNote}{" "}
          <Link href="/dashboard" className="font-extrabold text-clay-primary underline">
            {l.chatLink}
          </Link>
          .
        </p>
      </div>
    </main>
  );
}