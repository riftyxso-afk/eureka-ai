"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronRight, Mic, MicOff, SlidersHorizontal, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { useMomoCall, type CallProvider } from "./useMomoCall";
import "./momo-call.css";

const labels = {
  permission: "Menunggu izin mikrofon…",
  connecting: "Menghubungkan…",
};

function CallScreen({ onClose, chat }: { onClose: () => void; chat: boolean }) {
  const { phase, muted, error, transcript, reply, backup, level, start, stop, toggleMute,
    workspaceLinks, workspaceLoading, deleteTitle, confirmWorkspaceDelete, turns, showCurrent, sendText } = useMomoCall(onClose);
  const waiting = phase === "permission" || phase === "connecting";
  const dialog = useRef<HTMLDialogElement>(null);
  const cloud = useRef<HTMLSpanElement>(null);
  const orb = useRef<HTMLDivElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const followThread = useRef(true);
  const [draft, setDraft] = useState("");
  const [settings, setSettings] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [provider, setProvider] = useState<CallProvider | null>(null);
  const [lalaAvailable, setLalaAvailable] = useState<boolean | null>();
  const name = provider === "lala" ? "Lala" : "Momo";
  const status = phase === "idle" ? `Bicara dengan ${name}`
    : phase === "listening" ? (muted ? "Mikrofon dimatikan" : `${name} mendengarkan`)
    : phase === "thinking" ? `${name} sedang berpikir`
    : phase === "searching" ? `${name} sedang mencari informasi…`
    : phase === "working" ? (deleteTitle ? "Lala menunggu konfirmasi" : "Lala sedang mengerjakan permintaanmu…")
    : phase === "speaking" ? `${name} sedang berbicara`
    : labels[phase];

  useEffect(() => {
    const element = thread.current;
    if (chat && followThread.current && element) element.scrollTop = element.scrollHeight;
  }, [chat, turns, transcript, reply, captions, workspaceLinks, workspaceLoading, deleteTitle, error]);

  useEffect(() => {
    const controller = new AbortController();
    void apiFetch("/api/call/session", { signal: controller.signal })
      .then(async response => response.ok ? (await response.json()).lala === true : null)
      .then(value => { if (!controller.signal.aborted) setLalaAvailable(value); })
      .catch(() => { if (!controller.signal.aborted) setLalaAvailable(null); });
    return () => controller.abort();
  }, []);

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

  function choose(choice: CallProvider) {
    if (provider || (choice === "lala" && lalaAvailable !== true)) return;
    setProvider(choice);
    void start(choice);
  }

  if (!provider) return <dialog className="momo-call is-choosing" ref={dialog} aria-labelledby="momo-call-title"
    onCancel={event => { event.preventDefault(); end(); }}>
    <header className="momo-call-header">
      <h2 id="momo-call-title">Mau ngobrol dengan siapa?</h2>
      <button type="button" className="momo-call-settings" aria-label="Tutup pilihan" onClick={end}>
        <X size={22} aria-hidden="true" />
      </button>
    </header>
    <div className="momo-call-choice">
      <div className="momo-call-picker" role="group" aria-label="Teman bicara">
        <button type="button" onClick={() => choose("momo")}>
          <span className="momo-call-swatch" aria-hidden="true" />
          <span className="momo-call-option-copy"><strong>Momo</strong><small>Bantu kamu memahami topik langkah demi langkah.</small></span>
          <ChevronRight className="momo-call-option-arrow" size={18} aria-hidden="true" />
        </button>
        <button type="button" disabled={lalaAvailable !== true} onClick={() => choose("lala")}>
          <span className="momo-call-swatch is-lala" aria-hidden="true" />
          <span className="momo-call-option-copy"><strong>Lala</strong><small>Jawaban cepat dan langsung ke inti.</small></span>
          <ChevronRight className="momo-call-option-arrow" size={18} aria-hidden="true" />
        </button>
      </div>
      {lalaAvailable !== true && <p role="status">
        {lalaAvailable === undefined ? "Memeriksa ketersediaan Lala…" : "Lala sedang tidak tersedia."}
      </p>}
    </div>
  </dialog>;

  return <dialog className={`momo-call${chat ? " is-chat-call" : ""}`} data-provider={provider} ref={dialog} aria-labelledby="momo-call-title"
    onCancel={event => { event.preventDefault(); end(); }}>
    <header className="momo-call-header">
      <h2 id="momo-call-title">Panggilan {name}</h2>
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
        {status}
      </p>
    </div>
    <div className="momo-call-text" ref={thread} aria-label={chat ? "Transkrip panggilan" : undefined}
      onScroll={chat ? event => {
        const el = event.currentTarget;
        followThread.current = el.scrollHeight - el.scrollTop - el.clientHeight < 56;
      } : undefined}
      data-workspace={Boolean(deleteTitle || workspaceLoading || workspaceLinks.length)}>
      {chat && captions && <>
        {turns.map((turn, index) => <div className="momo-call-turn" key={index}>
          {turn.question && <p className="momo-call-user" aria-label="Kamu">{turn.question}</p>}
          {turn.answer && <p className="momo-call-response" aria-label={name}>{turn.answer}</p>}
        </div>)}
        {showCurrent && <div className="momo-call-turn">
          {transcript && <p className="momo-call-user" aria-label="Kamu">{transcript}</p>}
          {reply && <p className="momo-call-response" aria-label={name}>{reply}</p>}
        </div>}
      </>}
      {deleteTitle && <div className="momo-call-confirm" role="group" aria-label="Konfirmasi hapus catatan">
        <p>Hapus catatan <strong>{deleteTitle}</strong>?</p>
        <div>
          <button type="button" onClick={() => confirmWorkspaceDelete(false)}>Batal</button>
          <button type="button" onClick={() => confirmWorkspaceDelete(true)}>Hapus catatan</button>
        </div>
      </div>}
      {workspaceLoading && !deleteTitle && <div className="momo-call-work-progress" role="status">
        <span className="momo-call-work-spinner" aria-hidden="true" />
        <span>{workspaceLoading}</span>
      </div>}
      {error && <p className="momo-call-error" role="alert">{error}</p>}
      {!error && phase === "idle" && <p>Ketuk mikrofon untuk mulai ngobrol.</p>}
      {backup && !error && phase === "listening" && !muted && !transcript && <p>Bicara lalu jeda sebentar agar Momo bisa menjawab.</p>}
      {!chat && captions && phase !== "idle" && (reply || transcript) && <p className="momo-call-caption">{reply || transcript}</p>}
      {workspaceLinks.length > 0 && <p className="momo-call-result-hint">Buka hasilnya kapan saja, atau lanjut ngobrol di sini.</p>}
      {workspaceLinks.map(link => <a key={link.href} href={link.href} className="momo-call-result-link"
        onClick={event => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) stop(); }}>
        <span><strong>{link.label}</strong><small>{link.title}</small></span>
        <ChevronRight size={17} aria-hidden="true" />
      </a>)}
    </div>
    <form className="momo-call-controls" onSubmit={event => {
      event.preventDefault();
      if (chat && sendText(draft)) { followThread.current = true; setDraft(""); }
    }}>
      {chat && <>
        <input aria-label="Ketik pesan saat panggilan" placeholder="Ketik pesan…" value={draft}
          maxLength={2000} onChange={event => setDraft(event.target.value)} />
        {draft.trim() && <button type="submit" className="momo-call-control momo-call-send"
          disabled={phase !== "listening"} aria-label="Kirim pesan"><ArrowUp size={19} aria-hidden="true" /></button>}
      </>}
      <button type="button" disabled={waiting} className="momo-call-control"
        aria-label={phase === "idle" ? "Mulai panggilan" : muted ? "Aktifkan mikrofon" : "Bisukan mikrofon"}
        title={phase === "idle" ? "Mulai panggilan" : muted ? "Aktifkan mikrofon" : "Bisukan mikrofon"}
        aria-pressed={phase === "idle" || waiting ? undefined : muted}
        onClick={() => phase === "idle" ? void start(provider) : toggleMute()}>
        {muted ? <MicOff size={21} aria-hidden="true" /> : <Mic size={21} aria-hidden="true" />}
      </button>
      <button type="button" className="momo-call-control" onClick={end} title="Akhiri panggilan" aria-label="Akhiri panggilan">
        <X size={22} aria-hidden="true" />
      </button>
    </form>
  </dialog>;
}

export default function AiCallModal({ open, onClose, chat = false }: { open: boolean; onClose: () => void; chat?: boolean }) {
  return open ? <CallScreen onClose={onClose} chat={chat} /> : null;
}
