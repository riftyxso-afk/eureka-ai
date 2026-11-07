"use client";
import MomoCompanion from "@/components/asisten/MomoCompanion";

export default function StudyDreaming({ title, detail, compact = false, completed, total, characters, paper = false }: { title: string; detail: string; compact?: boolean; completed?: number; total?: number; characters?: number; paper?: boolean }) {
  return <div className={`sd-dream ${compact ? "is-compact" : ""} ${paper ? "is-paper" : ""}`} role="status" aria-live="polite">
    <div className="sd-orbit" aria-hidden="true"><i /><i /><i /><div className="sr-momo"><MomoCompanion mode="deep" thinking /></div><span className="sd-thought"><b /><b /><b /></span></div>
    <div className="sd-copy"><small>MOMO DREAMING</small><h2>{title}</h2><p>{detail}</p>{typeof completed === "number" && total ? <span className="sd-real-progress">{completed} dari {total} bab dikembangkan</span> : null}{typeof characters === "number" && characters > 0 && <span className="sd-character-count">{characters.toLocaleString("id-ID")} karakter diterima</span>}</div>
    {paper && <div className="sd-paper-lines" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>}
  </div>;
}
