"use client";

import Image from "next/image";
import Link from "next/link";
import { BookOpen, Brain, CalendarDays, ChevronRight, Flame, MessageCircle, Sparkles, Star, Target, Trophy, Zap } from "lucide-react";
import "./learning-journey.css";

type Progress = { xp: number; level: number; xpInLevel: number; xpToNext: number; streak: number; dueCards: number; rank: number | null };
type Props = { name: string; locale: string; progress: Progress; progressLoaded: boolean; onCreateNote: () => void; onOpenWorkspace: () => void };

export default function LearningJourney({ name, locale, progress, progressLoaded, onCreateNote, onOpenWorkspace }: Props) {
  const en = locale === "en";
  const firstName = name?.trim().split(" ")[0];
  const percent = progressLoaded && progress.xpToNext > 0 ? Math.max(0, Math.min(100, progress.xpInLevel / progress.xpToNext * 100)) : 0;
  const number = (value: number) => progressLoaded ? value.toLocaleString(en ? "en-US" : "id-ID") : "—";
  return (
    <div className="journey-page">
      <header className="journey-top">
        <div><p className="journey-eyebrow">{en ? "YOUR LEARNING SPACE" : "RUANG BELAJARMU"}</p><h1>{en ? "Let's learn" : "Yuk, belajar"}{firstName ? `, ${firstName}` : ""}!</h1><p>{en ? "A little progress makes a big difference." : "Sedikit demi sedikit, kamu makin paham."}</p></div>
        <div className="journey-top-stats" aria-label={en ? "Learning progress" : "Progres belajar"}>
          <Link href="/dashboard/streaks" title={en ? "Study streak" : "Streak belajar"}><Flame size={21} className="journey-orange"/><strong>{number(progress.streak)}</strong><span>{en ? "day streak" : "hari streak"}</span></Link>
          <Link href="/dashboard/profil" title="XP"><Zap size={20} className="journey-yellow"/><strong>{number(progress.xp)}</strong><span>XP</span></Link>
        </div>
      </header>
      <div className="journey-columns">
        <main className="journey-main">
          <section className="journey-unit" aria-labelledby="journey-title">
            <div><span>{en ? "YOUR LEARNING PATH" : "JALUR BELAJARMU"}</span><h2 id="journey-title">{en ? "Let's make learning fun!" : "Mulai perjalanan belajarmu!"}</h2><p>{en ? "Choose a step and learn at your own pace." : "Pilih langkahmu dan belajar dengan caramu sendiri."}</p></div>
            <Link href="/dashboard/panduan" className="journey-guide"><BookOpen size={19}/>{en ? "GUIDE" : "PANDUAN"}</Link>
          </section>
          <div className="journey-path">
            <div className="journey-step step-one"><span className="journey-callout">{en ? "START HERE" : "MULAI DI SINI"}</span><button type="button" onClick={onCreateNote} className="journey-node node-primary" aria-label={en ? "Create a learning note" : "Buat catatan belajar"}><Star fill="currentColor" size={29}/></button><div className="journey-step-label"><strong>{en ? "Create a note" : "Buat catatan"}</strong><span>{en ? "Start with your material" : "Mulai dari materi kamu"}</span></div></div>
            <div className="journey-step step-two"><Link href="/chat" className="journey-node node-violet" aria-label={en ? "Open AI assistant" : "Buka asisten AI"}><MessageCircle fill="currentColor" size={27}/></Link><div className="journey-step-label"><strong>{en ? "Ask Eureka" : "Tanya Eureka"}</strong><span>{en ? "Understand it together" : "Pahami bersama AI"}</span></div></div>
            <div className="journey-mascot"><Image src="/onboarding/eureka-welcome.png" alt="" width={180} height={180}/><span>{en ? "You've got this!" : "Kamu pasti bisa!"}</span></div>
            <div className="journey-step step-three"><Link href="/dashboard/mata-pelajaran" className="journey-node node-cyan" aria-label={en ? "Explore subjects" : "Jelajahi mata pelajaran"}><BookOpen size={28}/></Link><div className="journey-step-label"><strong>{en ? "Explore subjects" : "Jelajahi materi"}</strong><span>{en ? "Find what to learn" : "Temukan yang ingin dipelajari"}</span></div></div>
            <div className="journey-step step-four"><Link href="/dashboard/misi" className="journey-node node-yellow" aria-label={en ? "See missions" : "Lihat misi"}><Trophy size={28}/></Link><div className="journey-step-label"><strong>{en ? "Complete missions" : "Selesaikan misi"}</strong><span>{en ? "Build your study habit" : "Bangun kebiasaan belajar"}</span></div></div>
          </div>
        </main>
        <aside className="journey-aside">
          <section className="journey-card journey-level"><div className="journey-card-heading"><div><span className="journey-card-kicker">{en ? "YOUR PROGRESS" : "PROGRES BELAJAR"}</span><h2>{en ? "Keep going!" : "Terus melangkah!"}</h2></div><span className="journey-level-icon"><Sparkles size={22}/></span></div><p>{en ? "Every step brings you closer to your goal." : "Setiap langkah kecil berarti untuk belajarmu."}</p><div className="journey-level-row"><strong>{en ? "Level" : "Level"} {number(progress.level)}</strong><span>{progressLoaded ? `${number(progress.xpInLevel)} / ${number(progress.xpToNext)} XP` : (en ? "Progress unavailable" : "Progres belum tersedia")}</span></div><div className="journey-bar" role="progressbar" aria-label={en ? "Level progress" : "Progres level"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}><span style={{width:`${percent}%`}}/></div></section>
          <section className="journey-card"><div className="journey-card-heading"><h2>{en ? "Daily missions" : "Misi harian"}</h2><Link href="/dashboard/misi">{en ? "VIEW ALL" : "LIHAT SEMUA"}</Link></div><div className="journey-mission"><span><Target size={24}/></span><div><strong>{en ? "A little learning every day" : "Sedikit belajar setiap hari"}</strong><p>{en ? "Open your missions and see your progress." : "Lihat misi dan progres belajarmu hari ini."}</p></div></div><Link className="journey-card-link" href="/dashboard/misi">{en ? "See my missions" : "Lihat misiku"} <ChevronRight size={17}/></Link></section>
          <section className="journey-card"><div className="journey-card-heading"><h2>{en ? "Your next step" : "Langkah berikutnya"}</h2><span className="journey-small-star"><Star size={20}/></span></div><div className="journey-next"><span><Brain size={24}/></span><div><strong>{en ? "Ready to review?" : "Siap mengulang?"}</strong><p>{progressLoaded ? (en ? `${progress.dueCards} cards to review` : `${progress.dueCards} kartu untuk diulang`) : (en ? "Open a note to start practicing." : "Buka catatan untuk mulai berlatih.")}</p></div></div><button type="button" className="journey-outline" onClick={onOpenWorkspace}>{en ? "OPEN MY NOTES" : "BUKA CATATANKU"}</button></section>
          <Link className="journey-schedule" href="/dashboard/jadwal"><CalendarDays size={22}/><span><strong>{en ? "Make time to learn" : "Atur waktu belajarmu"}</strong><small>{en ? "Open study schedule" : "Buka jadwal belajar"}</small></span><ChevronRight size={19}/></Link>
          <p className="journey-footer">{en ? "Learn a little, grow a lot." : "Belajar sedikit, berkembang setiap hari."} <span>✦</span></p>
        </aside>
      </div>
    </div>
  );
}
