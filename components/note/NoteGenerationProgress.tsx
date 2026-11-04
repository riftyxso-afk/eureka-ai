"use client";

import { ArrowRight, Square, X } from "lucide-react";
import { LoadingMomo } from "./LoadingMomo";
import { NoteLoadingSteps } from "@/components/note/NoteLoadingSteps";
import type { NoteStep } from "@/components/note/useNoteSteps";
import "./note-generation-progress.css";

type Props = {
  message: string;
  percent: number;
  steps: NoteStep[];
  onBackground: () => void;
  onStop: () => void;
  canStop: boolean;
  stopping: boolean;
};

export function NoteGenerationProgress({ message, percent, steps, onBackground, onStop, canStop, stopping }: Props) {
  const progress = Math.max(0, Math.min(100, Math.round(percent)));
  const readingWeb = /(?:membaca|memuat|mengambil|reading|loading|fetching).*(?:https?:|\bweb\b)/i.test(message);
  return <section className="note-generation" aria-labelledby="note-generation-title">
    <div className="note-generation-top">
      <span className="note-generation-eyebrow">CATATAN BARU</span>
      <button type="button" className="note-generation-close" onClick={onBackground} aria-label="Tutup dan lanjutkan di latar belakang"><X size={18} /></button>
    </div>
    <div className="note-generation-intro flex-wrap">
      <div className="note-generation-copy">
        <h2 id="note-generation-title">{readingWeb ? "Momo sedang membaca halaman web" : "Momo sedang menyiapkan catatanmu"}</h2>
        <p>{readingWeb ? "Momo mengambil isi halaman untuk dijadikan catatan." : "Materimu sedang disusun supaya lebih mudah dipelajari."}</p>
      </div>
      <LoadingMomo reading={readingWeb} />
    </div>
    <div className="note-generation-progress-card">
      <div className="note-generation-progress-heading"><span>Progres pembuatan</span><strong>{progress}%</strong></div>
      <div className="note-generation-track" role="progressbar" aria-label="Progres pembuatan catatan" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <div className="note-generation-fill" style={{ width: `${progress}%` }} />
      </div>
      <p className="note-generation-current" aria-live="polite"><span className="note-generation-pulse" aria-hidden="true" />{message || "Menyiapkan materi…"}</p>
    </div>
    {steps.length > 0 && <div className="note-generation-steps rounded-xl border border-violet-100 px-2 pb-2 dark:border-violet-900">
      <NoteLoadingSteps steps={steps} />
    </div>}
    <p className="note-generation-hint">Catatan tetap diproses jika kamu menutup jendela ini.</p>
    <div className="note-generation-actions">
      <button type="button" className="note-generation-background" onClick={onBackground}>Lanjut di latar belakang <ArrowRight size={16} /></button>
      <button type="button" className="note-generation-stop" onClick={onStop} disabled={!canStop || stopping}><Square size={12} fill="currentColor" />{stopping ? "Menghentikan…" : "Hentikan proses"}</button>
    </div>
  </section>;
}
