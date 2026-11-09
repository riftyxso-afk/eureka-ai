import type { ReactNode } from "react";
import Link from "next/link";
import ThemeSwitch from "@/components/ui/ThemeSwitch";
import PageTutorial from "@/components/tutorial/PageTutorial";
import type { PageGuideId } from "@/lib/pageGuides";
import V2MobileSidebar, { V2MenuArt } from "./V2MobileSidebar";

export default function V2FeaturePage({ title, art, guide, children }: {
  title: string; art: number; guide: PageGuideId; children: ReactNode;
}) {
  return <div className="dv2 v2-feature-page">
    <header className="dv2-topbar">
      <V2MobileSidebar />
      <Link href="/dashboard-v2" className="dv2-brand">eureka! <span>V2 · Beta</span></Link>
      <nav className="dv2-topnav" aria-label="Ruang belajar">
        <Link href="/dashboard-v2#dv2-notes-title">Catatan</Link>
        <Link href="/dashboard-v2/mata-pelajaran" aria-current={guide === "subjects" ? "page" : undefined}>Mata Pelajaran</Link>
        <Link href="/dashboard-v2/misi" aria-current={guide === "missions" ? "page" : undefined}>Misi</Link>
        <Link href="/dashboard-v2/jadwal" aria-current={guide === "schedule" ? "page" : undefined}>Jadwal</Link>
        <Link href="/dashboard-v2/kursus" aria-current={guide === "courses" ? "page" : undefined}>Kursus</Link>
        <Link href="/dashboard-v2/tanya-momo">Tanya Momo</Link>
      </nav>
      <div className="dv2-account"><ThemeSwitch /><PageTutorial guideId={guide} /></div>
    </header>
    <div className="v2-feature-content">
      <div className="v2-feature-marker"><V2MenuArt index={art} /><span>{title}</span></div>
      {children}
    </div>
  </div>;
}
