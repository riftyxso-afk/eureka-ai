import Link from "next/link";
import { GraduationCap, LockKeyhole } from "lucide-react";

export default function CourseLockedLayout() {
  return (
    <main style={{ maxWidth: 720, margin: "clamp(40px, 10vh, 100px) auto", padding: "0 24px" }}>
      <section style={{ padding: "36px 28px", border: "1px solid #e9e0f4", borderRadius: 24, background: "#fff", textAlign: "center" }}>
        <span aria-hidden="true" style={{ display: "inline-grid", placeItems: "center", width: 64, height: 64, borderRadius: 20, background: "#f2eafb", color: "#7540d0" }}><GraduationCap size={30} /></span>
        <p style={{ margin: "22px 0 8px", color: "#7540d0", fontWeight: 700, fontSize: 13 }}><LockKeyhole size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />Sementara terkunci</p>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#292038" }}>Kursus sedang disiapkan</h1>
        <p style={{ margin: "12px auto 24px", maxWidth: 420, lineHeight: 1.6, color: "#746a80" }}>Kami sedang mengembangkan pengalaman belajar ini. Sementara itu, kamu bisa melanjutkan belajar dari dashboard.</p>
        <Link href="/dashboard" style={{ display: "inline-block", padding: "12px 20px", borderRadius: 12, background: "#7540d0", color: "white", fontWeight: 700 }}>Kembali ke dashboard</Link>
      </section>
    </main>
  );
}
