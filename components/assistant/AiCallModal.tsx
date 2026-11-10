"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, SlidersHorizontal, X } from "lucide-react";
import { useMomoCall } from "./useMomoCall";
import "./momo-call.css";

const labels = {
  idle: "Bicara dengan Momo",
  permission: "Menunggu izin mikrofon…",
  connecting: "Menghubungkan…",
  listening: "Momo mendengarkan",
  thinking: "Momo sedang berpikir",
  speaking: "Momo sedang berbicara",
};

function CallScreen({ onClose }: { onClose: () => void }) {
  const { phase, muted, error, transcript, reply, backup, level, start, stop, toggleMute } = useMomoCall();
  const waiting = phase === "permission" || phase === "connecting";
  const dialog = useRef<HTMLDialogElement>(null);
  const cloud = useRef<HTMLSpanElement>(null);
  const orb = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState(false);
  const [captions, setCaptions] = useState(true);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => { if (element?.open) element.close(); };
  }, []);

  useEffect(() => {
    if (phase !== "listening" && phase !== "speaking") return;
    const orbElement = orb.current;
    const cloudElement = cloud.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame: number;
    let energy = 0;
    const tick = () => {
      const sample = level();
      energy += (sample - energy) * (sample > energy ? 0.36 : 0.12);
      if (orbElement) orbElement.style.transform = reduced.matches ? "" : `scale(${1 + energy * 0.065})`;
      if (cloudElement) cloudElement.style.transform = reduced.matches ? "" : `translateY(${energy * -12}%) rotate(${energy * 12}deg)`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      orbElement?.style.removeProperty("transform");
      cloudElement?.style.removeProperty("transform");
    };
  }, [level, phase]);

  function end() {
    stop();
    onClose();
  }

  return <dialog className="momo-call" ref={dialog} aria-labelledby="momo-call-title"
    onCancel={event => { event.preventDefault(); end(); }}>
    <header className="momo-call-header">
      <h2 id="momo-call-title">Panggilan Momo</h2>
      <button type="button" className="momo-call-settings" aria-label="Pengaturan panggilan"
        aria-expanded={settings} aria-controls="momo-call-settings-panel" onClick={() => setSettings(value => !value)}>
        <SlidersHorizontal size={18} aria-hidden="true" />
      </button>
      {settings && <div className="momo-call-settings-panel" id="momo-call-settings-panel">
        <label><input type="checkbox" checked={captions} onChange={event => setCaptions(event.target.checked)} /> Tampilkan transkrip</label>
      </div>}
    </header>
    <div className="momo-call-stage">
      <div ref={orb} className="momo-call-orb" data-phase={phase} aria-hidden="true">
        <span ref={cloud} className="momo-call-cloud" />
      </div>
      <p className="momo-call-status" role="status">
        {muted && phase === "listening" ? "Mikrofon dimatikan" : labels[phase]}
      </p>
    </div>
    <div className="momo-call-text">
      {error && <p className="momo-call-error" role="alert">{error}</p>}
      {!error && phase === "idle" && <p>Ketuk mikrofon untuk mulai ngobrol.</p>}
      {backup && !error && phase === "listening" && !muted && !transcript && <p>Bicara lalu jeda sebentar agar Momo bisa menjawab.</p>}
      {captions && phase !== "idle" && (reply || transcript) && <p className="momo-call-caption">{reply || transcript}</p>}
    </div>
    <footer className="momo-call-controls">
      <button type="button" disabled={waiting} className="momo-call-control"
        aria-label={phase === "idle" ? "Mulai panggilan" : muted ? "Aktifkan mikrofon" : "Bisukan mikrofon"}
        title={phase === "idle" ? "Mulai panggilan" : muted ? "Aktifkan mikrofon" : "Bisukan mikrofon"}
        aria-pressed={phase === "idle" || waiting ? undefined : muted}
        onClick={() => phase === "idle" ? void start() : toggleMute()}>
        {muted ? <MicOff size={21} aria-hidden="true" /> : <Mic size={21} aria-hidden="true" />}
      </button>
      <button type="button" className="momo-call-control" onClick={end} title="Akhiri panggilan" aria-label="Akhiri panggilan">
        <X size={22} aria-hidden="true" />
      </button>
    </footer>
  </dialog>;
}

export default function AiCallModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <CallScreen onClose={onClose} /> : null;
}
