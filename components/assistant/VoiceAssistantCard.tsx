"use client";

// Adapted from transitions.dev Community: https://transitions.dev/studio.html?id=c85AR0dBjUE
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { VoiceBeam } from "voice-glow";
import { MicOff } from "lucide-react";
import "./voice-assistant-card.css";

function SwapText({ value }: { value: string }) {
  const [shown, setShown] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (value === shown || !ref.current) return;
    ref.current.classList.remove("is-enter-start");
    ref.current.classList.add("is-exit");
    const timer = setTimeout(() => setShown(value), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 150);
    return () => clearTimeout(timer);
  }, [value, shown]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el?.classList.contains("is-exit")) return;
    el.classList.remove("is-exit");
    el.classList.add("is-enter-start");
    void el.offsetHeight;
    el.classList.remove("is-enter-start");
  }, [shown]);
  return <span ref={ref} className="eva-text-swap">{shown}</span>;
}

export interface VoiceAssistantCardProps {
  name: string;
  phase: string;
  status: string;
  muted: boolean;
  waiting: boolean;
  captions: boolean;
  transcript: string;
  reply: string;
  level: () => number;
  onMic: () => void;
  compact?: boolean;
}

export default function VoiceAssistantCard({ name, phase, status, muted, waiting, captions, transcript, reply, level, onMic, compact = false }: VoiceAssistantCardProps) {
  const [dark, setDark] = useState(false);
  const wave = useRef<HTMLSpanElement>(null);
  const processing = ["thinking", "searching", "working", "connecting"].includes(phase);
  const audible = phase === "speaking" || (phase === "listening" && !muted);

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setDark(root.classList.contains("dark") || root.dataset.theme === "dark");
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!audible) { wave.current?.removeAttribute("data-reactive"); return; }
    let frame = 0;
    let energy = 0;
    const tick = () => {
      const sample = Math.max(0, Math.min(1, level()));
      energy += (sample - energy) * (sample > energy ? .36 : .12);
      if (wave.current) {
        wave.current.dataset.reactive = String(energy > .015);
        wave.current.style.setProperty("--voice-level", String(.35 + energy * .85));
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [audible, level]);

  return <div className={`eureka-voice-card${compact ? " is-compact" : ""}`} data-provider={name.toLowerCase()}>
    <VoiceBeam className="eva-beam" level={audible ? level : 0} processing={processing}
      active={phase !== "idle"} theme={dark ? "dark" : "light"} idle={0}
      colors={name === "Lala" ? ["#b39cf9", "#d6b9fa", "#8c68d7", "#c6b5ee", "#e2d9fa"] : ["#91c8ff", "#b5dcff", "#a897ee", "#c8b9f4", "#ddd5fb"]}>
      <div className="eva-inner">
        <header className="eva-top"><span className={`momo-call-swatch${name === "Lala" ? " is-lala" : ""}`} aria-hidden="true" />
          <div><strong>{name}</strong><small>Teman bicara kamu</small></div>
          <span className="eva-live-dot" data-live={audible} aria-hidden="true" />
        </header>
        {!compact && <div className="eva-body">
          <div className="eva-bubble-row"><p className="eva-bubble">{captions && reply ? reply : waiting ? "Sebentar ya, kita sedang terhubung." : "Aku di sini. Mau bahas apa hari ini?"}</p></div>
          {captions && transcript && <p className="eva-transcript" aria-label="Ucapanmu">{transcript.split(/(\s+)/).map((word, index) => /^\s+$/.test(word) ? word : <span className="eva-stream-word" key={index}>{word}</span>)}</p>}
        </div>}
        <div className="eva-bottom">
          <p className="eva-caption" role="status"><SwapText value={status} /></p>
          <button type="button" className="eva-mic" disabled={waiting} onClick={onMic}
            aria-label={phase === "idle" ? "Mulai panggilan" : muted ? "Aktifkan mikrofon" : "Bisukan mikrofon"}
            aria-pressed={phase === "idle" || waiting ? undefined : muted}>
            {muted ? <MicOff size={20} aria-hidden="true" /> : <span className="eva-wave" ref={wave} aria-hidden="true"><i /><i /><i /><i /><i /></span>}
          </button>
        </div>
      </div>
    </VoiceBeam>
  </div>;
}
