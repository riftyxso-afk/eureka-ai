"use client";
import { useEffect, useRef, useState } from "react";
import ChevronDown from "kubai-icons-react/icons/chevron-down";
import Check from "kubai-icons-react/icons/circle-check";
import { studyTargets } from "@/lib/study-goal";

export default function StudyTarget({ value, onChange, disabled }: { value: number; onChange: (value: number) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) { if (!container.current?.contains(event.target as Node)) setOpen(false); }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return <div ref={container} className="study-target" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={event => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }}>
    <button ref={trigger} type="button" disabled={disabled} aria-expanded={open} aria-controls="study-target-options" onClick={() => setOpen(!open)}>{value ? `Rencana ${value} hari` : "Belajar bebas"}<ChevronDown size={15} aria-hidden="true" /></button>
    {open && <div className="study-target-popover" id="study-target-options">
      <strong>Atur ritme belajarmu</strong><p>Belajar bebas untuk bertanya atau membuat sesuatu. Pilih durasi untuk menyusun rencana.</p>
      <div role="group" aria-label="Durasi rencana belajar">{studyTargets.map(days => <button key={days} type="button" aria-pressed={value === days} onClick={() => { onChange(days); setOpen(false); trigger.current?.focus(); }}><span>{days ? `${days} hari` : "Bebas · tanpa jadwal"}</span>{days === value && <Check size={16} aria-hidden="true" />}</button>)}</div>
    </div>}
  </div>;
}
