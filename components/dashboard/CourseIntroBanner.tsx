"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight, X } from "lucide-react";
import "./call-intro-banner.css";

const key = "eureka:course-intro:v1";
let shown = false;
export default function CourseIntroBanner({ paused }: { paused: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (paused || shown) return;
    let timer: number;
    const show = () => {
      try { if (localStorage.getItem(key) === "seen") return; } catch { /* use memory */ }
      if (!dialog.current?.isConnected || shown) return;
      if (document.visibilityState !== "visible" || document.querySelector("dialog[open]")) { timer = window.setTimeout(show, 600); return; }
      dialog.current.showModal();
      shown = true;
      try { localStorage.setItem(key, "seen"); } catch { /* use memory */ }
    };
    timer = window.setTimeout(show, 2400);
    return () => window.clearTimeout(timer);
  }, [paused]);
  return <dialog ref={dialog} className="call-intro" aria-labelledby="course-intro-title" aria-describedby="course-intro-description">
    <div className="call-intro-art"><Image src="/brand/course-intro.png" alt="" width={960} height={480} /><button type="button" className="call-intro-close" aria-label="Tutup pengumuman" onClick={() => dialog.current?.close()}><X size={20} /></button></div>
    <div className="call-intro-content"><span className="call-intro-badge">FITUR BARU · BETA</span><h2 id="course-intro-title">Belajar lebih terarah bersama Momo</h2><p id="course-intro-description">Pilih kursus atau buat jalur belajarmu sendiri. Pelajari materi, tanya Momo, dan uji pemahaman di setiap langkah.</p><div className="call-intro-actions"><Link href="/dashboard-v2/kursus" className="call-intro-try" onClick={() => dialog.current?.close()}>Jelajahi kursus <ArrowRight size={17} /></Link><button type="button" className="call-intro-later" onClick={() => dialog.current?.close()}>Nanti saja</button></div></div>
  </dialog>;
}
