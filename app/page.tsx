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
} from "lucide-react";

import { isLoggedIn } from "@/lib/auth";

const FEATURES = [
  {
    icon: Brain,
    title: "Socratic AI Tutor",
    desc: "Eureka nggak ngasih jawaban instan — dia bimbing lewat pertanyaan bertahap sampai kamu dapet momen 'Eureka!' sendiri.",
  },
  {
    icon: FileText,
    title: "Catatan Otomatis",
    desc: "Tempel link YouTube, halaman web, atau upload PDF — AI ubah jadi catatan belajar terstruktur per bab.",
  },
  {
    icon: MessageCircleQuestion,
    title: "Tanya Apa Saja per Bab",
    desc: "Kesulitan satu topik? Tanya AI langsung di bab itu, jawabannya fokus ke materi yang sedang kamu pelajari.",
  },
  {
    icon: Users,
    title: "Belajar Bareng Teman",
    desc: "Kolaborasi real-time di catatan yang sama: chat, kehadiran editor, stabilo bareng, sampai papan tulis.",
  },
  {
    icon: Sparkles,
    title: "Kuis & Flashcards Otomatis",
    desc: "Setiap catatan langsung dapat kuis dan kartu hafalan dari AI — latihan tanpa bikin soal sendiri.",
  },
  {
    icon: Flame,
    title: "Streak & XP",
    desc: "Belajar rutin bikin streak tetap nyala. Naik level, kumpulin XP, dan lihat posisimu di leaderboard.",
  },
];

const STEPS = [
  {
    icon: Upload,
    title: "Masukkan Materi",
    desc: "Tempel link YouTube/web atau unggah PDF/DOCX — apa saja sumber belajarmu.",
  },
  {
    icon: Sparkles,
    title: "AI Bikin Catatan",
    desc: "Materi diubah jadi bab-bab rapi, ringkasan, poin penting, kuis, dan flashcards.",
  },
  {
    icon: Brain,
    title: "Belajar sampai Eureka!",
    desc: "Tanya AI per bab, kerjain kuis, dan ulangi kartu hafalan sampai paham banget.",
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

  return (
    <div className="min-h-screen bg-clay-beige">
      {/* Navbar */}
      <header className="sticky top-0 z-40 border-b-2 border-clay-shadow/30 bg-clay-beige/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo Eureka.AI" className="h-10 w-10 object-contain" />
            <span className="text-xl font-extrabold text-clay-dark">
              Eureka<span className="text-clay-primary">.AI</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-extrabold text-clay-muted md:flex">
            <a href="#fitur" className="transition-colors hover:text-clay-primary">
              Fitur
            </a>
            <a href="#cara-kerja" className="transition-colors hover:text-clay-primary">
              Cara Kerja
            </a>
            <a href="#harga" className="transition-colors hover:text-clay-primary">
              Harga
            </a>
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {loggedIn ? (
              <Link
                href="/dashboard"
                className="btn-clay-primary !min-h-[44px] !px-3 !py-2 text-sm sm:!px-5"
              >
                Buka Dashboard{" "}
                <ArrowRight size={16} className="ml-1 hidden sm:inline" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="btn-clay-ghost !min-h-[44px] !px-3 !py-2 text-sm sm:!px-5"
                >
                  Masuk
                </Link>
                <Link
                  href="/register"
                  className="btn-clay-primary !min-h-[44px] !px-3 !py-2 text-sm sm:!px-5"
                >
                  Trial
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-clay-primary/10" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-clay-secondary/10" />
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-clay-full border-3 border-clay-primary/30 bg-clay-primary/10 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wide text-clay-primary">
                <Sparkles size={14} /> AI Tutor untuk Semua Pelajar
              </span>
              <h1 className="mt-6 text-4xl font-extrabold leading-[1.15] text-clay-dark sm:text-5xl lg:text-6xl">
                Bukan ngasih jawaban, tapi ngasih{" "}
                <span className="text-clay-primary">Eureka!</span> 🎉
              </h1>
              <p className="mt-6 max-w-xl text-lg font-semibold leading-relaxed text-clay-muted">
                Eureka.AI adalah tutor pribadi dengan metode Socratic. Dia
                bimbing kamu menemukan jawabannya sendiri — lewat pertanyaan
                bertahap, catatan otomatis, dan latihan yang personal.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                {loggedIn ? (
                  <Link href="/dashboard" className="btn-clay-primary">
                    Lanjut Belajar <ArrowRight size={18} className="ml-2" />
                  </Link>
                ) : (
                  <>
                    <Link href="/register" className="btn-clay-primary">
                      Mulai Trial <ArrowRight size={18} className="ml-2" />
                    </Link>
                    <Link href="/login" className="btn-clay-secondary">
                      Saya sudah punya akun
                    </Link>
                  </>
                )}
              </div>
              <p className="mt-4 text-sm font-bold text-clay-muted">
                Gratis selamanya untuk fitur dasar — tanpa kartu kredit
              </p>
            </div>

            {/* Ilustrasi mock catatan */}
            <div className="relative mx-auto w-full max-w-md">
              <div className="card-clay rotate-[-3deg] !p-6 shadow-clay-lg">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-clay-primary/15 text-xl">
                    🎬
                  </span>
                  <div>
                    <p className="text-sm font-extrabold text-clay-dark">
                      Turunan Fungsi — Konsep Dasar
                    </p>
                    <p className="text-xs font-bold text-clay-muted">YouTube · 12 menit</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-3 w-full rounded-full bg-clay-inputBg" />
                  <div className="h-3 w-5/6 rounded-full bg-clay-inputBg" />
                  <div className="h-3 w-4/6 rounded-full bg-clay-inputBg" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-clay-full bg-clay-primary/10 px-3 py-1 text-[11px] font-extrabold text-clay-primary">
                    Bab 1 · Limit & Laju Perubahan
                  </span>
                  <span className="rounded-clay-full bg-clay-success/10 px-3 py-1 text-[11px] font-extrabold text-clay-success">
                    5 kuis siap!
                  </span>
                </div>
              </div>
              <div className="card-clay absolute -bottom-8 -left-4 rotate-[-8deg] !p-5 shadow-clay">
                <p className="text-sm font-extrabold text-clay-dark">
                  💬 Eureka: “Kalau kamu lari 5 km dalam 30 menit, berapa
                  kecepatan rata-ratamu?”
                </p>
                <p className="mt-2 text-xs font-bold text-clay-muted">
                  🤔 Siswa: “10 km/jam… Ooooh, itu turunan!”
                </p>
              </div>
              <div className="card-clay absolute -right-4 -top-6 rotate-[5deg] !p-4 shadow-clay">
                <p className="text-xs font-extrabold text-clay-primary">🔥 Streak 7 hari</p>
                <p className="text-sm font-extrabold text-clay-dark">Level 3 · 245 XP</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Models */}
      <section className="border-t-2 border-clay-shadow/20 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <p className="text-sm font-extrabold uppercase tracking-widest text-clay-muted">
              Didukung oleh Model AI Terdepan
            </p>
            <h2 className="mt-3 text-2xl font-extrabold text-clay-dark sm:text-3xl">
              Teknologi di Balik Eureka.AI
            </h2>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {AI_MODELS.map((model) => (
              <div key={model.name} className="group flex flex-col items-center gap-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-clay-md border-2 border-clay-shadow/20 bg-white shadow-clay-sm transition-all duration-150 group-hover:-translate-y-1 group-hover:shadow-clay">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={model.logo} alt={model.name} className="h-8 w-8" />
                </div>
                <span className="text-xs font-extrabold text-clay-muted">{model.name}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm font-semibold text-clay-muted">
            Multi-model AI — otomatis memilih model terbaik untuk setiap tugas
          </p>
        </div>
      </section>

      {/* Fitur */}
      <section id="fitur" className="border-t-2 border-clay-shadow/20 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <p className="text-sm font-extrabold uppercase tracking-widest text-clay-secondary">
              Kenapa Eureka.AI?
            </p>
            <h2 className="mt-3 text-3xl font-extrabold text-clay-dark sm:text-4xl">
              Belajar yang bikin paham, bukan cuma hafal
            </h2>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="card-clay !p-6 transition-all duration-75 hover:-translate-y-1 hover:shadow-clay-lg"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-clay-md bg-clay-primary/10">
                  <f.icon size={22} className="text-clay-primary" />
                </span>
                <h3 className="mt-4 text-lg font-extrabold text-clay-dark">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-clay-muted">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cara kerja */}
      <section id="cara-kerja" className="border-t-2 border-clay-shadow/20 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <p className="text-sm font-extrabold uppercase tracking-widest text-clay-secondary">
              Cara Kerja
            </p>
            <h2 className="mt-3 text-3xl font-extrabold text-clay-dark sm:text-4xl">
              Dari materi mentah ke paham, dalam 3 langkah
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="card-clay flex flex-col items-center !p-8 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-clay-beige text-clay-primary shadow-clay-inset">
                  <s.icon size={26} />
                </span>
                <span className="mt-4 rounded-clay-full bg-clay-primary px-3 py-1 text-xs font-extrabold text-white">
                  Langkah {i + 1}
                </span>
                <h3 className="mt-3 text-lg font-extrabold text-clay-dark">{s.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-clay-muted">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bukti sosial */}
      <section className="border-t-2 border-clay-shadow/20 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="card-clay flex flex-col items-center !p-6 text-center">
              <Trophy size={24} className="text-clay-secondary" />
              <p className="mt-3 text-3xl font-extrabold text-clay-dark">60%+</p>
              <p className="text-sm font-bold text-clay-muted">
                peningkatan pemahaman konsep dalam 2 minggu*
              </p>
            </div>
            <div className="card-clay flex flex-col items-center !p-6 text-center">
              <Flame size={24} className="text-clay-secondary" />
              <p className="mt-3 text-3xl font-extrabold text-clay-dark">7 hari</p>
              <p className="text-sm font-bold text-clay-muted">
                rata-rata streak belajar pengguna aktif
              </p>
            </div>
            <div className="card-clay flex flex-col items-center !p-6 text-center">
              <BookOpen size={24} className="text-clay-secondary" />
              <p className="mt-3 text-3xl font-extrabold text-clay-dark">100%</p>
              <p className="text-sm font-bold text-clay-muted">
                catatan dibuat AI — tinggal belajar, nggak perlu nyatet manual
              </p>
            </div>
          </div>
          <p className="mt-4 text-center text-xs font-semibold text-clay-muted">
            *angka ilustrasi dari uji internal
          </p>
        </div>
      </section>

      {/* Harga */}
      <section id="harga" className="border-t-2 border-clay-shadow/20 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <p className="text-sm font-extrabold uppercase tracking-widest text-clay-secondary">
              Harga
            </p>
            <h2 className="mt-3 text-3xl font-extrabold text-clay-dark sm:text-4xl">
              Mulai gratis, upgrade kapan pun
            </h2>
          </div>
          <div className="mx-auto mt-12 grid max-w-3xl gap-6 sm:grid-cols-2">
            <div className="card-clay flex flex-col !p-8">
              <p className="text-sm font-extrabold uppercase tracking-widest text-clay-muted">
                Gratis
              </p>
              <p className="mt-2 text-4xl font-extrabold text-clay-dark">
                Rp 0<span className="text-lg font-bold text-clay-muted">/bulan</span>
              </p>
              <ul className="mt-6 flex-1 space-y-3 text-sm font-semibold text-clay-muted">
                <li className="flex items-center gap-2"><Check size={16} className="shrink-0 text-clay-success" /> Chat AI Socratic (dengan batas harian)</li>
                <li className="flex items-center gap-2"><Check size={16} className="shrink-0 text-clay-success" /> 3 catatan otomatis dari materi</li>
                <li className="flex items-center gap-2"><Check size={16} className="shrink-0 text-clay-success" /> Kuis & flashcards dasar</li>
                <li className="flex items-center gap-2"><Check size={16} className="shrink-0 text-clay-success" /> Streak, XP & leaderboard</li>
              </ul>
              <Link href="/register" className="btn-clay-ghost mt-8 !min-h-[52px] !px-5 text-sm">
                Mulai Trial
              </Link>
            </div>
            <div className="card-clay relative flex flex-col border-3 border-clay-primary !p-8 shadow-clay-lg">
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-clay-full bg-clay-primary px-4 py-1 text-xs font-extrabold uppercase tracking-wide text-white">
                Terpopuler
              </span>
              <p className="text-sm font-extrabold uppercase tracking-widest text-clay-primary">
                Pro
              </p>
              <p className="mt-2 text-4xl font-extrabold text-clay-dark">
                Rp 59.000
                <span className="text-lg font-bold text-clay-muted">/bulan</span>
              </p>
              <ul className="mt-6 flex-1 space-y-3 text-sm font-semibold text-clay-muted">
                <li className="flex items-center gap-2"><Check size={16} className="shrink-0 text-clay-success" /> Semua fitur Gratis</li>
                <li className="flex items-center gap-2"><Check size={16} className="shrink-0 text-clay-success" /> Chat AI tanpa batas</li>
                <li className="flex items-center gap-2"><Check size={16} className="shrink-0 text-clay-success" /> Catatan otomatis tanpa batas</li>
                <li className="flex items-center gap-2"><Check size={16} className="shrink-0 text-clay-success" /> Kolaborasi real-time dengan teman</li>
                <li className="flex items-center gap-2"><Check size={16} className="shrink-0 text-clay-success" /> Akses fitur baru lebih dulu</li>
              </ul>
              <Link href="/register" className="btn-clay-primary mt-8 flex !min-h-[52px] items-center justify-center !px-5 text-sm">
                <Crown size={16} className="mr-2" /> Langganan Pro
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA akhir */}
      <section className="px-4 pb-20 pt-4 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="card-clay flex flex-col items-center border-3 border-clay-primary !p-10 text-center shadow-clay-lg">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-clay-primary/10 text-clay-primary">
              <Rocket size={40} />
            </span>
            <h2 className="mt-4 text-3xl font-extrabold text-clay-dark sm:text-4xl">
              Siap mengalami momen Eureka pertamamu?
            </h2>
            <p className="mt-3 max-w-xl text-base font-semibold text-clay-muted">
              Mulai trial sekarang, tempel materi pertamamu, dan biarkan AI
              membimbingmu sampai paham — bukan sekadar hafal.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              {loggedIn ? (
                <Link href="/dashboard" className="btn-clay-primary">
                  Buka Dashboard <ArrowRight size={18} className="ml-2" />
                </Link>
              ) : (
                <>
                  <Link href="/register" className="btn-clay-primary">
                    Mulai Trial <ArrowRight size={18} className="ml-2" />
                  </Link>
                  <Link href="/login" className="btn-clay-secondary">
                    Masuk
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-clay-shadow/30 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo Eureka.AI" className="h-8 w-8 object-contain" />
            <span className="text-lg font-extrabold text-clay-dark">
              Eureka<span className="text-clay-primary">.AI</span>
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm font-extrabold text-clay-muted">
            <a href="#fitur" className="transition-colors hover:text-clay-primary">Fitur</a>
            <a href="#cara-kerja" className="transition-colors hover:text-clay-primary">Cara Kerja</a>
            <a href="#harga" className="transition-colors hover:text-clay-primary">Harga</a>
          </div>
          <p className="text-xs font-bold text-clay-muted">
            © {new Date().getFullYear()} Eureka.AI — Bukan ngasih jawaban, tapi ngasih Eureka!
          </p>
        </div>
      </footer>
    </div>
  );
}
