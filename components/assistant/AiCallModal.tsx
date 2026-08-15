"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Mic, PhoneOff, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";

type CallPhase = "idle" | "listening" | "thinking" | "speaking";

/** Minimal interface Web Speech API (untuk TypeScript tanpa lib.dom tambahan). */
interface SpeechRecognitionResultEvent {
  results: ArrayLike<{ [j: number]: { transcript: string } }>;
}
interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

const PHASE_HINTS: Record<CallPhase, string> = {
  idle: "Tahan tombol untuk bicara",
  listening: "Mendengarkan…",
  thinking: "Eureka berpikir…",
  speaking: "Eureka menjawab…",
};

/** Jumlah bar visualizer. */
const BARS = 7;

/**
 * Modal panggilan suara AI (beta) — near-realtime hold-to-talk.
 * STT: Web Speech API (browser) → server AI → TTS: speechSynthesis (id-ID).
 */
export default function AiCallModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");

  const holdingRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const barEls = useRef<(HTMLSpanElement | null)[]>([]);

  const stopMetering = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  /** Animasikan bar visualizer mengikuti volume mikrofon (saat mendengar). */
  const startMetering = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      src.connect(analyser);
      analyserRef.current = analyser;

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        const a = analyserRef.current;
        if (!a) return;
        a.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i];
        const level = sum / buf.length / 255; // 0..1
        barEls.current.forEach((el, i) => {
          if (!el) return;
          const base = 0.25 + 0.15 * Math.sin(i * 1.7);
          const h = Math.max(0.15, Math.min(1, base + level * 1.4));
          el.style.transform = `scaleY(${h})`;
        });
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Mikrofon ditolak — metering tidak jalan, hanya visual idle.
    }
  }, []);

  /** Bicara (press & hold): mulai STT browser. */
  const startListening = useCallback(async () => {
    setError(null);
    setTranscript("");
    setReply("");
    holdingRef.current = true;

    if (typeof window === "undefined") return;
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SpeechRec = w.SpeechRecognition ?? w.webkitSpeechRecognition;

    if (!SpeechRec) {
      setError(
        "Browser kamu belum mendukung input suara (perlu Chrome/Edge). Gunakan tombol Rekam di composer sebagai alternatif."
      );
      setPhase("idle");
      return;
    }

    const rec = new SpeechRec();
    rec.lang = "id-ID";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let t = "";
      for (let i = e.results.length - 1; i >= 0; i--) {
        const r = e.results[i];
        if (r && r[0] && typeof r[0].transcript === "string") {
          t = r[0].transcript + t;
          break;
        }
      }
      setTranscript(t.trim());
    };
    rec.onerror = () => {
      setError("Tidak mendengar suara. Coba lagi ya 🙏");
      setPhase("idle");
    };
    rec.onend = () => {
      if (holdingRef.current) {
        // Speech dianggap selesai otomatis → tetap proses.
        void processTranscript();
      }
    };
    recognitionRef.current = rec;
    setPhase("listening");
    void startMetering();
    try {
      rec.start();
    } catch {
      setError("Input suara gagal dimulai. Coba lagi ya 🙏");
      setPhase("idle");
    }
  }, []);

  /** Lepas hold: stop STT, kirim teks ke /api/call, bacakan jawaban. */
  const stopListening = useCallback(() => {
    holdingRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      // abaikan
    }
    void processTranscript();
  }, []);

  const processTranscript = useCallback(async () => {
    const q = transcript.trim();
    if (!q || phase === "thinking" || phase === "speaking") return;
    setPhase("thinking");
    stopMetering();
    barEls.current.forEach((el) => {
      if (el) el.style.transform = "scaleY(0.9)";
    });

    const userId = getUserId();
    if (!userId) {
      setError("Silakan masuk dulu ya.");
      setPhase("idle");
      return;
    }

    try {
      const res = await apiFetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, question: q }),
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        reply?: string;
        error?: string;
      } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "Gagal memanggil AI. Coba lagi ya 🙏");
        setPhase("idle");
        return;
      }
      const answer = body.reply ?? "";
      setReply(answer);
      await speak(answer);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Gagal memanggil AI. Coba lagi ya 🙏"
      );
      setPhase("idle");
    }
  }, [transcript, phase, stopMetering]);

  /** Bacakan jawaban dengan TTS id-ID. */
  const speak = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        setPhase("idle");
        resolve();
        return;
      }
      const synth = window.speechSynthesis;
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "id-ID";
      utter.rate = 1.05;
      utter.onstart = () => setPhase("speaking");
      utter.onend = () => {
        setPhase("idle");
        resolve();
      };
      utter.onerror = () => {
        setPhase("idle");
        resolve();
      };
      // Pilih suara id-ID bila tersedia.
      const voices = synth.getVoices();
      const idVoice = voices.find((v) => v.lang?.toLowerCase().startsWith("id"));
      if (idVoice) utter.voice = idVoice;
      synth.cancel();
      synth.speak(utter);
    });
  }, []);

  const cleanup = useCallback(() => {
    holdingRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      // abaikan
    }
    recognitionRef.current = null;
    window.speechSynthesis?.cancel();
    stopMetering();
    setPhase("idle");
    setTranscript("");
    setReply("");
    setError(null);
    barEls.current.forEach((el) => {
      if (el) el.style.transform = "scaleY(0.5)";
    });
  }, [stopMetering]);

  useEffect(() => {
    if (!open) cleanup();
    return () => {
      if (open) cleanup();
    };
  }, [open, cleanup]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 22, stiffness: 300 }}
            className="relative w-full max-w-sm rounded-clay border-2 border-clay-borderLight bg-clay-beige p-6 text-center shadow-clay-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute right-3 top-3 rounded-full p-1.5 text-clay-muted hover:bg-clay-inputBg hover:text-clay-dark"
              aria-label="Tutup panggilan"
            >
              <X size={16} />
            </button>

            {/* Avatar */}
            <div
              className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 text-3xl transition-colors duration-300 ${
                phase === "speaking"
                  ? "border-green-400 bg-green-50"
                  : phase === "listening"
                    ? "animate-pulse border-clay-primary bg-clay-primary/15"
                    : phase === "thinking"
                      ? "border-amber-400 bg-amber-50"
                      : "border-clay-borderLight bg-white"
              }`}
            >
              {phase === "thinking" ? (
                <Loader2 size={28} className="animate-spin text-amber-500" />
              ) : (
                <span className="align-middle leading-none">🎓</span>
              )}
            </div>

            <h2 className="mt-3 text-lg font-extrabold">Panggilan Eureka</h2>

            {/* Visualizer */}
            <div
              className="mt-4 flex h-16 items-center justify-center gap-1.5"
              aria-hidden
            >
              {Array.from({ length: BARS }).map((_, i) => (
                <span
                  key={i}
                  ref={(el) => {
                    barEls.current[i] = el;
                  }}
                  className={`w-2.5 origin-center rounded-full transition-colors duration-300 ${
                    phase === "speaking"
                      ? "bg-green-400"
                      : phase === "listening"
                        ? "bg-clay-primary"
                        : phase === "thinking"
                          ? "bg-amber-400"
                          : "bg-clay-shadow/40"
                  }`}
                  style={{ height: "100%", transform: "scaleY(0.5)" }}
                />
              ))}
            </div>

            <p className="mt-2 text-sm font-extrabold text-clay-muted">
              {PHASE_HINTS[phase]}
            </p>

            {/* Transkrip & jawaban */}
            {(transcript || reply) && (
              <div className="mt-3 space-y-2 text-left">
                {transcript && (
                  <p className="rounded-clay-md bg-clay-inputBg px-3 py-2 text-[13px] font-semibold text-clay-dark">
                    <span className="font-extrabold text-clay-muted">Kamu:</span>{" "}
                    {transcript}
                  </p>
                )}
                {reply && (
                  <p className="rounded-clay-md border-2 border-green-200 bg-green-50 px-3 py-2 text-[13px] font-semibold text-clay-dark">
                    <span className="font-extrabold text-green-600">
                      Eureka:
                    </span>{" "}
                    {reply}
                  </p>
                )}
              </div>
            )}

            {error && (
              <p className="mt-3 rounded-clay-md border-2 border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
                {error}
              </p>
            )}

            {/* Hold-to-talk */}
            <div className="mt-5 flex flex-col items-center gap-2">
              <button
                onPointerDown={() => void startListening()}
                onPointerUp={stopListening}
                onPointerLeave={stopListening}
                onContextMenu={(e) => e.preventDefault()}
                disabled={phase === "thinking" || phase === "speaking"}
                className={`flex h-16 w-16 items-center justify-center rounded-full border-4 transition-all duration-75 select-none touch-none active:scale-95 ${
                  phase === "listening"
                    ? "border-red-400 bg-red-500 text-white"
                    : "border-clay-primary bg-clay-primary text-white"
                } disabled:opacity-60`}
                aria-label="Tahan untuk bicara"
              >
                <Mic size={26} />
              </button>
              <p className="text-[11px] font-bold text-clay-muted">
                Tekan &amp; tahan untuk bicara · lepas untuk kirim
              </p>
              <button
                onClick={onClose}
                className="mt-1 flex items-center gap-1.5 text-xs font-extrabold text-red-500 hover:underline"
              >
                <PhoneOff size={13} /> Akhiri panggilan
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
