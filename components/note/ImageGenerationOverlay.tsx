"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Download,
  ImageIcon,
  Maximize2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";

interface ImageGenerationOverlayProps {
  open: boolean;
  /** Prompt asli user (mis. "buatkan gambar sel hewan"). */
  prompt: string;
  /** Konteks percakapan (topik yang sedang dibahas) — untuk gambar sesuai topik. */
  history?: { role: "user" | "assistant"; content: string }[];
  onClose: () => void;
}

type Phase = "preparing" | "drawing" | "done" | "error";

const PREPARING_STEPS = [
  "Membaca permintaanmu…",
  "Menyusun konsep sesuai topik…",
  "Menggambar dengan AI (FLUX)…",
];

/** Gaya loading ala DreamingOverlay: blob kabur + partikel + shimmer. */
const DREAM_CSS = `
@keyframes eureka-img-orbit {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(22px, -28px) scale(1.07); }
  50% { transform: translate(-16px, 20px) scale(0.95); }
  75% { transform: translate(10px, 16px) scale(1.04); }
}
@keyframes eureka-img-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.95; }
}
@keyframes eureka-img-shimmer {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(240%); }
}
@keyframes eureka-img-twinkle {
  0%, 100% { opacity: 0.2; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.15); }
}
@keyframes eureka-img-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
`;

const BLOBS = [
  { size: 220, top: "8%", left: "6%", color: "#8B5CF6", delay: 0, duration: 18 },
  { size: 190, top: "58%", left: "70%", color: "#F59E0B", delay: 3, duration: 22 },
  { size: 150, top: "70%", left: "10%", color: "#EC4899", delay: 6, duration: 16 },
  { size: 170, top: "12%", left: "72%", color: "#3B82F6", delay: 9, duration: 20 },
];

function getCss(root: Element | null) {
  if (!root) return null;
  const id = "eureka-img-styles";
  if (root.querySelector(`#${id}`)) return null;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = DREAM_CSS;
  root.appendChild(style);
  return style;
}

export function ImageGenerationOverlay({
  open,
  prompt,
  history = [],
  onClose,
}: ImageGenerationOverlayProps) {
  const [phase, setPhase] = useState<Phase>("preparing");
  const [stepIdx, setStepIdx] = useState(0);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [alt, setAlt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const startedRef = useRef(false);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const style = getCss(document.head);
    return () => {
      style?.remove();
    };
  }, []);

  const generate = async (setAsPreparing: boolean) => {
    const userId = getUserId();
    if (!userId) {
      setError("Login dulu untuk membuat gambar ya.");
      setPhase("error");
      return;
    }
    if (setAsPreparing) {
      setPhase("preparing");
      setStepIdx(0);
      setDataUrl(null);
    }
    try {
      const res = await apiFetch("/api/assistant/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, userId, history }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        dataUrl?: string;
        alt?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok || !data?.dataUrl) {
        throw new Error(data?.error || "Gagal membuat gambar. Coba lagi.");
      }
      setDataUrl(data.dataUrl);
      setAlt(data.alt || "Ilustrasi");
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan.");
      setPhase("error");
    }
  };

  // Reset + mulai generate saat overlay dibuka.
  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      setPhase("preparing");
      setStepIdx(0);
      setDataUrl(null);
      setAlt("");
      setError(null);
      setViewerOpen(false);
      if (stepTimer.current) clearInterval(stepTimer.current);
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    setPhase("preparing");
    setStepIdx(0);
    stepTimer.current = setInterval(() => {
      setStepIdx((i) => Math.min(i + 1, PREPARING_STEPS.length - 1));
    }, 900);

    void generate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="image-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#1E1B3A] via-[#2A1E4E] to-[#3B2A5E]"
          role="dialog"
          aria-modal="true"
          aria-label="Membuat gambar"
        >
          {/* Blob kabur + partikel (ala dreaming) */}
          {BLOBS.map((b, i) => (
            <div
              key={i}
              className="pointer-events-none absolute rounded-full mix-blend-screen blur-3xl"
              style={{
                width: b.size,
                height: b.size,
                top: b.top,
                left: b.left,
                background: `radial-gradient(circle at 35% 35%, ${b.color}, transparent 70%)`,
                animation: `eureka-img-orbit ${b.duration}s ease-in-out ${b.delay}s infinite, eureka-img-pulse 5s ease-in-out ${b.delay}s infinite`,
                opacity: 0.5,
              }}
            />
          ))}
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={`spark-${i}`}
              className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-white"
              style={{
                top: `${(i * 41 + 13) % 92}%`,
                left: `${(i * 57 + 9) % 92}%`,
                animation: `eureka-img-twinkle ${2.4 + (i % 4) * 0.7}s ease-in-out ${i * 0.25}s infinite`,
              }}
            />
          ))}

          {/* Kartu utama */}
          <motion.div
            initial={{ scale: 0.94, y: 14 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 240, damping: 24 }}
            className="relative z-10 mx-3 w-full max-w-md overflow-hidden rounded-clay border-3 border-white/15 bg-white/10 text-center shadow-clay-lg backdrop-blur-md sm:mx-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b-2 border-white/15 px-4 py-3.5 sm:px-5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-white/20 bg-white/10">
                  <ImageIcon size={17} className="text-clay-secondary" />
                </span>
                <div className="min-w-0 text-left">
                  <h2 className="truncate text-sm font-extrabold text-white sm:text-base">
                    {phase === "done"
                      ? "Gambarmu siap!"
                      : phase === "error"
                        ? "Ups, gagal"
                        : "Eureka Draw"}
                  </h2>
                  <p className="truncate text-[11px] font-bold text-white/60">
                    {phase === "preparing" || phase === "drawing"
                      ? `“${prompt.slice(0, 60)}${prompt.length > 60 ? "…" : ""}”`
                      : alt}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Tutup"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-white/15 bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-4 py-4 sm:px-5 sm:py-5">
              {phase === "preparing" || phase === "drawing" ? (
                <div className="flex flex-col items-center gap-4">
                  {/* Kartu gambar shimmer — kotak melengkung ala dreaming */}
                  <div
                    className="relative h-52 w-full max-w-xs overflow-hidden rounded-clay-md border-2 border-white/20 bg-white/5 shadow-clay"
                    style={{ animation: "eureka-img-float 3.5s ease-in-out infinite" }}
                  >
                    {/* Shimmer bergerak */}
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/10 to-transparent" />
                    <div
                      className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                      style={{ animation: "eureka-img-shimmer 1.5s ease-in-out infinite" }}
                    />
                    {/* Ikon tengah */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <motion.div
                        animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.06, 1] }}
                        transition={{ duration: 1.8, repeat: Infinity }}
                        className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-clay-secondary/50 bg-clay-primary/20"
                      >
                        <Sparkles size={22} className="text-clay-secondary" />
                      </motion.div>
                      <p className="px-4 text-[11px] font-bold text-white/60">
                        {PREPARING_STEPS[stepIdx]}
                      </p>
                    </div>
                  </div>

                  {/* Langkah bertahap */}
                  <div className="w-full max-w-xs space-y-1.5">
                    {PREPARING_STEPS.map((s, i) => {
                      const active = i === stepIdx;
                      const done = i < stepIdx;
                      return (
                        <div
                          key={s}
                          className={`flex items-center gap-2.5 rounded-clay-full px-3 py-1.5 transition-colors ${
                            active ? "bg-white/10" : ""
                          }`}
                        >
                          {done ? (
                            <Check size={14} className="shrink-0 text-emerald-400" />
                          ) : active ? (
                            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-clay-secondary border-t-transparent" />
                          ) : (
                            <span className="h-4 w-4 shrink-0 rounded-full border-2 border-white/20" />
                          )}
                          <span
                            className={`text-[12.5px] font-bold ${
                              done
                                ? "text-emerald-300"
                                : active
                                  ? "text-white"
                                  : "text-white/50"
                            }`}
                          >
                            {s}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[11px] font-bold text-white/50">
                    ±10-20 detik — kamu boleh tetap di halaman ini ya
                  </p>
                </div>
              ) : phase === "error" ? (
                <div className="rounded-clay-md border-2 border-red-300/60 bg-red-500/15 px-4 py-3 text-sm font-bold text-red-100">
                  {error}
                </div>
              ) : (
                /* Hasil gambar — klik untuk lihat fullscreen */
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={() => setViewerOpen(true)}
                    className="group relative block w-full overflow-hidden rounded-clay-md border-2 border-white/20 shadow-clay transition-transform duration-75 active:scale-[0.99]"
                    aria-label="Lihat gambar penuh"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={dataUrl ?? ""}
                      alt={alt}
                      className="max-h-[44vh] w-full object-contain"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/25">
                      <span className="flex items-center gap-1.5 rounded-clay-full bg-black/50 px-3.5 py-2 text-xs font-extrabold text-white opacity-0 transition-opacity group-hover:opacity-100">
                        <Maximize2 size={13} /> Lihat Penuh
                      </span>
                    </span>
                  </button>
                  <div className="flex w-full flex-wrap items-center justify-center gap-2">
                    <a
                      href={dataUrl ?? "#"}
                      download={`eureka-${Date.now()}.png`}
                      className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-clay-md bg-clay-secondary px-4 py-2.5 text-sm font-extrabold text-white shadow-clay-btn transition-all duration-75 hover:-translate-y-0.5 active:translate-y-1 sm:flex-none"
                    >
                      <Download size={15} /> Unduh
                    </a>
                    <button
                      onClick={() => setViewerOpen(true)}
                      className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-clay-md border-2 border-white/25 bg-white/10 px-4 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-white/20 sm:flex-none"
                    >
                      <Maximize2 size={15} /> Lihat
                    </button>
                    <button
                      onClick={() => void generate(true)}
                      className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-clay-md border-2 border-white/25 bg-white/10 px-4 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-white/20 sm:flex-none"
                    >
                      <RefreshCw size={15} /> Buat Ulang
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {(phase === "done" || phase === "error") && (
              <div className="border-t-2 border-white/15 px-4 py-3 sm:px-5">
                <button
                  onClick={onClose}
                  className="w-full min-h-[42px] rounded-clay-md border-2 border-white/20 bg-white/5 py-2 text-sm font-extrabold text-white/85 transition-colors hover:bg-white/15"
                >
                  {phase === "done" ? "Selesai" : "Tutup"}
                </button>
              </div>
            )}
          </motion.div>

          {/* Viewer fullscreen */}
          <AnimatePresence>
            {viewerOpen && dataUrl && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-[90] flex flex-col bg-black/95"
                onClick={() => setViewerOpen(false)}
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <p className="truncate text-sm font-extrabold text-white">
                    {alt || "Gambar"}
                  </p>
                  <button
                    onClick={() => setViewerOpen(false)}
                    aria-label="Tutup tampilan penuh"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div
                  className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 pb-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={dataUrl}
                    alt={alt}
                    className="max-h-full max-w-full rounded-clay-md object-contain shadow-clay-lg"
                  />
                </div>
                <div className="flex gap-2 px-4 pb-6 pt-1">
                  <a
                    href={dataUrl}
                    download={`eureka-${Date.now()}.png`}
                    className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-clay-md bg-clay-secondary px-4 py-3 text-sm font-extrabold text-white shadow-clay-btn transition-all duration-75 active:translate-y-1"
                  >
                    <Download size={16} /> Unduh Gambar
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
