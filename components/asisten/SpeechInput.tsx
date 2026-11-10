"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import VoicePill from "./reactbits/VoicePill";
import { apiFetch } from "@/lib/apiClient";
import "./SpeechInput.css";

type Props = {
  userId: string;
  disabled?: boolean;
  onText: (text: string) => void;
  onError: (message: string) => void;
  onBusyChange?: (busy: boolean) => void;
};

export default function SpeechInput({ userId, disabled, onText, onError, onBusyChange }: Props) {
  const [transcribing, setTranscribing] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const request = useRef<AbortController | null>(null);
  const discard = useRef(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  const callbacks = useRef({ onText, onError, onBusyChange });
  useLayoutEffect(() => { callbacks.current = { onText, onError, onBusyChange }; }, [onText, onError, onBusyChange]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      discard.current = true;
      request.current?.abort();
      if (recorder.current?.state === "recording") recorder.current.stop();
    };
  }, []);

  async function transcribe(blob: Blob) {
    if (!mounted.current || discard.current) return;
    if (!blob.size) {
      locked.current = false; setTranscribing(false); callbacks.current.onBusyChange?.(false);
      callbacks.current.onError("Rekaman kosong. Coba bicara sekali lagi."); return;
    }
    setTranscribing(true);
    callbacks.current.onBusyChange?.(true);
    const controller = new AbortController();
    request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 100_000);
    try {
      const extension = /mp4/i.test(blob.type) ? "m4a" : /ogg/i.test(blob.type) ? "ogg" : "webm";
      const form = new FormData();
      form.append("userId", userId);
      form.append("audio", blob, `rekaman.${extension}`);
      const response = await apiFetch("/api/audio/transcribe", { method: "POST", body: form, signal: controller.signal });
      const result = await response.json().catch(() => null) as { ok?: boolean; text?: string; error?: string } | null;
      if (!response.ok || !result?.ok || !result.text) throw new Error(result?.error || "Transkripsi gagal. Silakan coba lagi.");
      if (mounted.current) callbacks.current.onText(result.text);
    } catch (error) {
      if (mounted.current) callbacks.current.onError(controller.signal.aborted ? "Transkripsi terlalu lama. Silakan coba lagi." : error instanceof Error ? error.message : "Transkripsi gagal. Silakan coba lagi.");
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) request.current = null;
      locked.current = false;
      if (mounted.current) { setTranscribing(false); callbacks.current.onBusyChange?.(false); }
    }
  }

  function start({ stream }: { stream?: MediaStream }) {
    if (locked.current) throw new Error("Transkripsi masih berlangsung.");
    if (!stream || typeof MediaRecorder === "undefined") throw new Error("Perekaman tidak didukung.");
    callbacks.current.onError("");
    discard.current = false;
    const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type));
    const active = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    active.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    active.onerror = () => { discard.current = true; callbacks.current.onError("Rekaman terputus. Silakan coba lagi."); };
    active.onstop = () => {
      if (recorder.current === active) recorder.current = null;
      if (!discard.current) void transcribe(new Blob(chunks, { type: active.mimeType || mime || "audio/webm" }));
    };
    recorder.current = active;
    active.start(250);
  }

  function stop({ reason }: { reason: string }) {
    discard.current = ["cancel", "escape", "blur", "disabled", "unmount", "mic-denied"].includes(reason);
    if (reason === "mic-denied" && mounted.current) callbacks.current.onError("Mikrofon tidak tersedia. Izinkan akses mikrofon dan gunakan browser terbaru melalui HTTPS atau localhost.");
    if (recorder.current?.state === "recording") {
      if (!discard.current) {
        locked.current = true;
        setTranscribing(true);
        callbacks.current.onBusyChange?.(true);
      }
      recorder.current.stop();
    }
  }

  return <span className="speech-input" aria-busy={transcribing}>
    <VoicePill size={34} reactive="mic" mode="toggle" disabled={disabled || transcribing || !userId}
      ariaLabel="Ubah suara menjadi teks" background="var(--speech-bg)" iconColor="var(--speech-ink)" accentColor="var(--speech-accent)"
      onStart={start} onStop={stop} />
    <span className="sr-only" role="status">{transcribing ? "Mengubah suara menjadi teks…" : ""}</span>
    {transcribing && <span className="speech-input__processing" aria-hidden="true">Mentranskripsi…</span>}
  </span>;
}
