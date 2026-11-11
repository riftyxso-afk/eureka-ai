import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import PageTutorial from "@/components/tutorial/PageTutorial";
import type { PageGuideId } from "@/lib/pageGuides";
import V2MobileSidebar, { V2MenuArt } from "./V2MobileSidebar";

export default function V2FeaturePage({ title, art, guide, children }: {
  title: string; art: number; guide?: PageGuideId; children: ReactNode;
}) {
  return <div className="dv2 v2-feature-page">
    <header className="dv2-topbar">
      <V2MobileSidebar desktop />
      <Link href="/dashboard-v2" className="dv2-brand"><Image src="/icons/momo-192.png" alt="" width={32} height={32} className="eureka-brand-mark" />eureka! <span>V2 · Beta</span></Link>
      <nav className="dv2-topnav" aria-label="Ruang belajar">
        <Link href="/dashboard-v2/catatan">Catatan</Link>
        <Link href="/dashboard-v2/tanya-momo">Tanya Momo</Link>
      </nav>
      <div className="dv2-account">{guide && <PageTutorial guideId={guide} />}</div>
    </header>
    <div className="v2-feature-content">
      <div className="v2-feature-marker"><V2MenuArt index={art} /><span>{title}</span></div>
      {children}
    </div>
  </div>;
}
