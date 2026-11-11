"use client";

import { useEffect, useState } from "react";
import "./practice-motion.css";

const TIPS = {
  quiz: [
    "Baca semua pilihan sebelum menentukan jawaban.",
    "Jelaskan alasan jawabanmu dengan satu kalimat.",
    "Gunakan pembahasan untuk memahami jawaban yang belum tepat.",
  ],
  flashcards: [
    "Coba ingat jawabannya sebelum membalik kartu.",
    "Tandai kartu yang sulit agar bisa kamu ulangi.",
    "Ucapkan jawaban dengan kata-katamu sendiri.",
  ],
};

export default function PracticeLoading({ kind, count }: { kind: "quiz" | "flashcards"; count?: number }) {
  const [seconds, setSeconds] = useState(0);
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return <section className="practice-loading" data-kind={kind} aria-busy="true">
    <div className="practice-loading-scene" aria-hidden="true">
      {[0, 1, 2].map(index => <div className="practice-loading-card" key={index}>
        <span className="practice-loading-line" />
        <span className="practice-loading-line is-short" />
        <div className="practice-loading-options"><i /><i /><i /></div>
        <span className="practice-loading-card-back" />
      </div>)}
      <span className="practice-loading-spark" />
    </div>
    <div className="practice-loading-copy" role="status">
      <h2>{kind === "quiz" ? `Menyusun ${count ? count + " " : ""}pertanyaanmu` : "Merangkai kartu hafalanmu"}</h2>
      <p>{kind === "quiz"
        ? "AI sedang menyiapkan soal, pilihan jawaban, dan pembahasannya."
        : "AI sedang mengubah konsep penting menjadi kartu tanya dan jawab."}</p>
    </div>
    <span className="practice-loading-time" aria-hidden="true">{seconds} detik berlalu</span>
    <div className="practice-loading-tip">
      <p key={tip}>{TIPS[kind][tip]}</p>
      <button type="button" onClick={() => setTip(current => (current + 1) % TIPS[kind].length)}>Tips berikutnya <span aria-hidden="true">↗</span></button>
    </div>
  </section>;
}
