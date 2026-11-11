import Image from "next/image";
import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import V2FeaturePage from "@/components/dashboard/V2FeaturePage";

export default function Page() {
  return <V2FeaturePage title="Jalur kursus" art={4} guide="courses">
    <main className="v2-course-preview">
      <div className="v2-course-illustration"><Image src="/onboarding/eureka-welcome.png" alt="" width={640} height={440} sizes="(max-width: 700px) 85vw, 440px" /></div>
      <div className="v2-course-intro">
        <p className="v2-course-status"><LockKeyhole size={15} />Dalam pengembangan</p>
        <h1>Kursus personal</h1>
        <p>Jalur belajar dengan bab dan latihan sedang disiapkan. Sambil menunggu, kamu bisa memulai jalur belajarmu dari catatan yang sudah ada.</p>
        <ol><li>Pilih materi</li><li>Pelajari bab</li><li>Uji pemahaman</li></ol>
        <Link className="dv2-button" href="/dashboard-v2/catatan">Buka koleksi catatan <ArrowRight size={17} /></Link>
      </div>
    </main>
  </V2FeaturePage>;
}
