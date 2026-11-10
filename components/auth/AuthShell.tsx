"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useI18n } from "@/context/LocaleContext";
import "./auth.css";

export default function AuthShell({ children, mode }: { children: ReactNode; mode: "login" | "register" }) {
  const { locale } = useI18n();
  const en = locale === "en";
  return (
    <main className="auth-page">
      <header className="auth-header">
        <Link href="/" className="auth-brand" aria-label={en ? "Eureka.AI, home" : "Eureka.AI, beranda"}>
          <Image src="/icons/momo-192.png" alt="" width={32} height={32} className="eureka-brand-mark" /><span>eureka!</span>
        </Link>
        <Link href="/" className="auth-home">{en ? "Back to home" : "Kembali ke beranda"} <span aria-hidden="true">↗</span></Link>
      </header>
      <div className="auth-layout">
        <aside className="auth-visual" aria-label={en ? "Learning with Eureka" : "Belajar bersama Eureka"}>
          <div className="auth-visual-copy">
            <span className="auth-kicker">{en ? "YOUR LEARNING COMPANION" : "TEMAN BELAJARMU"}</span>
            <h2>{mode === "login" ? (en ? "Ready for your next aha moment?" : "Siap menemukan hal baru hari ini?") : (en ? "A little curiosity goes a long way." : "Rasa penasaran adalah awal dari paham.")}</h2>
            <p>{en ? "Learn at your own pace, with a little help from Eureka." : "Pelan-pelan, satu langkah setiap hari. Eureka siap menemanimu belajar."}</p>
          </div>
          <Image src="/landing/Hp24z.png" alt="" width={768} height={768} className="auth-illustration" priority />
          <p className="auth-visual-caption">{en ? "Made for curious minds." : "Untuk setiap rasa ingin tahu."}</p>
        </aside>
        <section className="auth-content" aria-label={mode === "login" ? (en ? "Log in" : "Masuk") : (en ? "Sign up" : "Daftar")}>
          {children}
        </section>
      </div>
    </main>
  );
}
