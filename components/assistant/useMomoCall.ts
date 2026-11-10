"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";

type Phase = "idle" | "connecting" | "listening" | "thinking" | "speaking";
type Turn = { role: "user" | "assistant"; content: string };
type Playback = { controller: AbortController; sources: Set<AudioBufferSourceNode> };
type Session = {
  controller: AbortController;
  context: AudioContext;
  stream?: MediaStream;
  socket?: WebSocket;
  capture?: AudioWorkletNode;
  mic?: AnalyserNode;
  speaker: AnalyserNode;
  playback?: Playback;
  history: Turn[];
  muted: boolean;
  speaking: boolean;
  freshSpeech: boolean;
  timers: Set<number>;
};

const CONNECT_TIMEOUT = 15_000;
const SESSION_TIMEOUT = 12 * 60_000;
const SPEAKER_RATE = 24_000;

function stopPlayback(session: Session) {
  const playback = session.playback;
  session.playback = undefined;
  session.speaking = false;
  if (!playback) return;
  playback.controller.abort();
  for (const source of playback.sources) {
    source.stop();
    source.disconnect();
  }
  playback.sources.clear();
}

function dispose(session: Session) {
  session.controller.abort();
  session.timers.forEach(timer => window.clearTimeout(timer));
  stopPlayback(session);
  session.capture?.disconnect();
  if (session.capture) session.capture.port.onmessage = null;
  session.socket?.close();
  session.stream?.getTracks().forEach(track => track.stop());
  void session.context.close().catch(() => {});
}

async function readError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : fallback;
}

async function playPcm(response: Response, session: Session, playback: Playback, onPlaying: () => void) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Audio Momo tidak tersedia.");

  let nextTime = 0;
  let pending = new Uint8Array(0);
  let last: AudioBufferSourceNode | undefined;
  const schedule = (bytes: Uint8Array) => {
    const frames = Math.floor(bytes.length / 2);
    if (!frames) return;
    const buffer = session.context.createBuffer(1, frames, SPEAKER_RATE);
    const samples = buffer.getChannelData(0);
    const pcm = new DataView(bytes.buffer, bytes.byteOffset, frames * 2);
    for (let i = 0; i < frames; i++) samples[i] = pcm.getInt16(i * 2, true) / 32768;
    const source = session.context.createBufferSource();
    source.buffer = buffer;
    source.connect(session.speaker);
    playback.sources.add(source);
    source.onended = () => {
      source.disconnect();
      playback.sources.delete(source);
    };
    nextTime = Math.max(nextTime, session.context.currentTime + 0.06);
    source.start(nextTime);
    nextTime += buffer.duration;
    if (!last) onPlaying();
    last = source;
  };

  try {
    while (!playback.controller.signal.aborted) {
      const { done, value } = await reader.read();
      if (playback.controller.signal.aborted) return;
      if (done) break;
      const bytes = new Uint8Array(pending.length + value.length);
      bytes.set(pending);
      bytes.set(value, pending.length);
      if (bytes.length < 9600) {
        pending = bytes;
        continue;
      }
      const aligned = bytes.length - (bytes.length % 2);
      schedule(bytes.subarray(0, aligned));
      pending = bytes.slice(aligned);
    }
    if (playback.controller.signal.aborted) return;
    schedule(pending);
    const finalSource = last;
    if (!finalSource) throw new Error("Momo belum mengirim audio.");
    if (!playback.sources.has(finalSource)) return;
    await new Promise<void>(resolve => {
      finalSource.addEventListener("ended", () => resolve(), { once: true });
      playback.controller.signal.addEventListener("abort", () => resolve(), { once: true });
    });
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function useMomoCall() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const active = useRef<Session | null>(null);
  const meterSamples = useRef(new Float32Array(512));

  const stop = useCallback(() => {
    const session = active.current;
    active.current = null;
    if (session) dispose(session);
  }, []);
  useEffect(() => stop, [stop]);

  const level = useCallback(() => {
    const session = active.current;
    const analyser = session?.speaking ? session.speaker : session?.muted ? undefined : session?.mic;
    if (!analyser) return 0;
    const samples = meterSamples.current;
    analyser.getFloatTimeDomainData(samples);
    let total = 0;
    for (const sample of samples) total += sample * sample;
    return Math.min(1, Math.max(0, Math.sqrt(total / samples.length) - 0.006) * 5);
  }, []);

  function fail(message: string) {
    stop();
    setError(message);
    setPhase("idle");
  }

  async function answer(session: Session, question: string) {
    stopPlayback(session);
    const playback: Playback = { controller: new AbortController(), sources: new Set() };
    session.playback = playback;
    const signal = playback.controller.signal;
    const isCurrent = () => active.current === session && session.playback === playback;
    setPhase("thinking");
    setError("");
    setTranscript(question);
    setReply("");

    try {
      const response = await apiFetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history: session.history }),
        signal,
      });
      if (!response.ok) throw new Error(await readError(response, "Momo belum bisa menjawab."));
      const { reply: text } = await response.json() as { reply: string };
      if (!isCurrent()) return;
      session.history = [...session.history, { role: "user", content: question }, { role: "assistant", content: text }].slice(-12) as Turn[];
      setReply(text);

      const speech = await apiFetch("/api/call/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal,
      });
      if (!speech.ok) throw new Error(await readError(speech, "Suara Momo belum bisa diputar."));
      if (!isCurrent()) return;
      await playPcm(speech, session, playback, () => {
        if (!isCurrent()) return;
        session.speaking = true;
        setPhase("speaking");
      });
    } catch (cause) {
      if (isCurrent() && !signal.aborted) {
        setError(cause instanceof Error ? cause.message : "Panggilan sempat terputus.");
      }
    } finally {
      if (isCurrent()) {
        stopPlayback(session);
        setPhase("listening");
      }
    }
  }

  async function start() {
    if (active.current) return;
    setMuted(false);
    setError("");
    setTranscript("");
    setReply("");
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      fail("Mikrofon tidak tersedia di browser ini. Coba lewat HTTPS dengan browser terbaru.");
      return;
    }

    let context: AudioContext;
    try {
      context = new AudioContext();
    } catch {
      fail("Audio tidak bisa dimulai di perangkat ini.");
      return;
    }
    setPhase("connecting");
    const speaker = context.createAnalyser();
    speaker.fftSize = 512;
    speaker.connect(context.destination);
    const session: Session = {
      controller: new AbortController(), context, speaker, history: [],
      muted: false, speaking: false, freshSpeech: true, timers: new Set(),
    };
    active.current = session;
    const isCurrent = () => active.current === session;
    const connectTimer = window.setTimeout(() => {
      if (isCurrent()) fail("Koneksi suara terlalu lama. Coba lagi.");
    }, CONNECT_TIMEOUT);
    session.timers.add(connectTimer);

    try {
      const resume = context.resume();
      const microphone = navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      }).then(stream => {
        if (!isCurrent()) stream.getTracks().forEach(track => track.stop());
        else session.stream = stream;
        return stream;
      });
      const [stream] = await Promise.all([microphone, resume, context.audioWorklet.addModule("/audio/call-capture.js")]);
      if (!isCurrent()) return;

      const response = await apiFetch("/api/call/session", { method: "POST", signal: session.controller.signal });
      if (!response.ok) throw new Error(await readError(response, "Koneksi suara gagal."));
      const { token } = await response.json() as { token: string };
      if (!isCurrent()) return;

      const params = new URLSearchParams({
        token, model_id: "scribe_v2_realtime", audio_format: "pcm_16000",
        commit_strategy: "vad", vad_silence_threshold_secs: "0.8",
      });
      const socket = new WebSocket(`wss://api.elevenlabs.io/v1/speech-to-text/realtime?${params}`);
      session.socket = socket;
      const mic = context.createAnalyser();
      mic.fftSize = 512;
      session.mic = mic;
      const source = context.createMediaStreamSource(stream);
      source.connect(mic);
      const capture = new AudioWorkletNode(context, "momo-call-capture");
      session.capture = capture;
      source.connect(capture);
      // The processor writes no output. Connecting it keeps capture active on Safari.
      capture.connect(context.destination);
      for (const track of stream.getAudioTracks()) {
        track.onended = () => { if (isCurrent()) fail("Mikrofon terputus. Coba mulai panggilan lagi."); };
      }

      let ready = false;
      capture.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (!ready || !isCurrent() || session.muted || socket.readyState !== WebSocket.OPEN) return;
        if (socket.bufferedAmount > 128_000) {
          fail("Koneksi terlalu lambat untuk percakapan suara. Coba lagi.");
          return;
        }
        const bytes = new Uint8Array(event.data);
        socket.send(JSON.stringify({
          message_type: "input_audio_chunk", audio_base_64: btoa(String.fromCharCode(...bytes)),
          sample_rate: 16000, commit: false,
        }));
      };

      socket.onmessage = event => {
        if (!isCurrent() || typeof event.data !== "string") return;
        let message: { message_type?: string; text?: string };
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.message_type === "session_started") {
          ready = true;
          window.clearTimeout(connectTimer);
          session.timers.add(window.setTimeout(() => {
            if (isCurrent()) fail("Sesi suara selesai. Mulai lagi untuk melanjutkan.");
          }, SESSION_TIMEOUT));
          setPhase("listening");
          return;
        }
        const text = typeof message.text === "string" ? message.text.trim() : "";
        if (message.message_type === "partial_transcript" && text && !session.muted) {
          session.freshSpeech = true;
          if (session.playback) {
            stopPlayback(session);
            setReply("");
            setPhase("listening");
          }
          setTranscript(text);
        } else if (message.message_type === "committed_transcript" && text && !session.muted && session.freshSpeech) {
          void answer(session, text);
        } else if (message.message_type === "error" || message.message_type?.endsWith("_error") || message.message_type === "quota_exceeded") {
          fail("Layanan transkripsi realtime terputus. Coba lagi.");
        }
      };
      socket.onclose = () => { if (isCurrent()) fail("Panggilan terputus. Coba mulai lagi."); };
      socket.onerror = () => { if (isCurrent()) fail("Koneksi suara gagal. Coba lagi."); };
    } catch (cause) {
      if (!isCurrent()) return;
      if (cause instanceof DOMException && /NotAllowed|NotFound|NotReadable/.test(cause.name)) {
        fail("Mikrofon tidak bisa digunakan. Periksa izin mikrofon lalu coba lagi.");
      } else {
        fail(cause instanceof Error ? cause.message : "Panggilan suara gagal dimulai.");
      }
    }
  }

  function toggleMute() {
    const session = active.current;
    if (!session?.stream) return;
    session.muted = !session.muted;
    for (const track of session.stream.getAudioTracks()) track.enabled = !session.muted;
    if (session.muted) {
      session.freshSpeech = false;
      if (session.socket?.readyState === WebSocket.OPEN) {
        session.socket.send(JSON.stringify({ message_type: "input_audio_chunk", audio_base_64: "", commit: true, sample_rate: 16000 }));
      }
    }
    setMuted(session.muted);
  }

  return { phase, muted, error, transcript, reply, level, start, stop, toggleMute };
}
