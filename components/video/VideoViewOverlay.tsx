"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Captions,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { YoutubeEmbed } from "./YoutubeEmbed";
import { useYoutubePlayer } from "./useYoutubePlayer";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { extractYoutubeVideoId } from "@/lib/assistant/videoUrl";
import { activeSegmentIndex } from "@/lib/videoTranscriptShared";
import type { VideoTranscriptSegment } from "@/lib/videoTranscriptShared";

interface VideoViewOverlayProps {
  open: boolean;
  url: string;
  title?: string;
  onClose: () => void;
}

type PointsState =
  | { status: "loading" }
  | { status: "success"; points: string[] }
  | { status: "error"; error: string; retryable: boolean };

type SubtitleState =
  | { status: "loading" }
  | { status: "success"; segments: VideoTranscriptSegment[]; title: string }
  | { status: "no-subtitle" }
  | { status: "error"; error: string; retryable: boolean };

/** Peta status HTTP → pesan panel poin yang ramah. */
function pointsErrorLabel(
  status: number,
  message: string
): { error: string; retryable: boolean } {
  if (status === 401) {
    return {
      error: "Kamu perlu masuk/login dulu untuk melihat poin video.",
      retryable: false,
    };
  }
  if (status === 422) {
    return {
      error: "Transkrip video tidak tersedia, jadi poin tidak bisa dibuat.",
      retryable: false,
    };
  }
  if (status === 429) {
    return {
      error: "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.",
      retryable: true,
    };
  }
  return {
    error: message || "Gagal menyusun poin. Coba lagi.",
    retryable: true,
  };
}

/** Peta status HTTP → pesan panel subtitle yang ramah. */
function subtitleErrorLabel(
  status: number,
  message: string
): { error: string; retryable: boolean } {
  if (status === 401) {
    return {
      error: "Kamu perlu masuk/login dulu untuk melihat subtitle.",
      retryable: false,
    };
  }
  if (status === 429) {
    return {
      error: "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.",
      retryable: true,
    };
  }
  return {
    error: message || "Gagal memuat subtitle. Coba lagi.",
    retryable: true,
  };
}

/** 0 → "0:00", 75000 → "1:15". */
function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Tampilan expand "View" pada video YouTube: video di kiri (auto-play) +
 * panel subtitle sinkron di bawahnya + panel poin-poin isi video di kanan
 * (generate AI dari transkrip, di-cache server). Mobile: semua menumpuk.
 */
export function VideoViewOverlay({
  open,
  url,
  title,
  onClose,
}: VideoViewOverlayProps) {
  const [points, setPoints] = useState<PointsState>({ status: "loading" });
  const [subtitle, setSubtitle] = useState<SubtitleState>({
    status: "loading",
  });
  const [iframeEl, setIframeEl] = useState<HTMLIFrameElement | null>(null);
  const subtitleScrollRef = useRef<HTMLDivElement | null>(null);

  const videoId = extractYoutubeVideoId(url) ?? "";

  // Sinkronisasi pemutaran hanya aktif saat overlay terbuka & subtitle ada.
  const { currentTime, apiState, seekTo } = useYoutubePlayer(
    videoId,
    iframeEl,
    open && subtitle.status === "success"
  );

  // Kunci scroll halaman saat overlay terbuka, pulihkan saat tertutup.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const loadPoints = useCallback(async () => {
    setPoints({ status: "loading" });
    try {
      const res = await apiFetch("/api/video/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, userId: getUserId() }),
      });
      const data = (await res.json().catch(() => null)) as {
        points?: string[];
        error?: string;
      } | null;
      if (!res.ok) {
        setPoints({
          status: "error",
          ...pointsErrorLabel(res.status, data?.error ?? ""),
        });
        return;
      }
      if (!Array.isArray(data?.points) || data.points.length === 0) {
        setPoints({
          status: "error",
          error: "AI tidak menghasilkan poin yang valid. Coba lagi.",
          retryable: true,
        });
        return;
      }
      setPoints({ status: "success", points: data.points });
    } catch {
      setPoints({
        status: "error",
        error: "Terjadi kesalahan koneksi. Coba lagi.",
        retryable: true,
      });
    }
  }, [url]);

  const loadSubtitle = useCallback(async () => {
    setSubtitle({ status: "loading" });
    try {
      const res = await apiFetch("/api/video/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, userId: getUserId() }),
      });
      const data = (await res.json().catch(() => null)) as {
        segments?: VideoTranscriptSegment[];
        title?: string;
        error?: string;
      } | null;
      if (res.status === 422) {
        setSubtitle({ status: "no-subtitle" });
        return;
      }
      if (!res.ok) {
        setSubtitle({
          status: "error",
          ...subtitleErrorLabel(res.status, data?.error ?? ""),
        });
        return;
      }
      if (!Array.isArray(data?.segments) || data.segments.length === 0) {
        setSubtitle({ status: "no-subtitle" });
        return;
      }
      setSubtitle({
        status: "success",
        segments: data.segments,
        title: data.title ?? "",
      });
    } catch {
      setSubtitle({
        status: "error",
        error: "Terjadi kesalahan koneksi. Coba lagi.",
        retryable: true,
      });
    }
  }, [url]);

  useEffect(() => {
    if (open) {
      void loadPoints();
      void loadSubtitle();
    }
  }, [open, loadPoints, loadSubtitle]);

  const activeIndex = useMemo(() => {
    if (subtitle.status !== "success") return -1;
    return activeSegmentIndex(subtitle.segments, currentTime * 1000);
  }, [subtitle, currentTime]);

  // Auto-follow: geser panel subtitle secara halus agar segmen aktif selalu
  // terpusat di area pandang — pengguna tidak perlu scroll manual.
  useEffect(() => {
    if (activeIndex < 0 || !subtitleScrollRef.current) return;
    const container = subtitleScrollRef.current;
    const el = container.querySelector<HTMLElement>(
      '[data-active="true"]'
    );
    if (!el) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const target =
      container.scrollTop +
      (elRect.top - containerRect.top) -
      container.clientHeight / 2 +
      elRect.height / 2;
    const max = container.scrollHeight - container.clientHeight;
    container.scrollTo({
      top: Math.min(Math.max(0, target), max),
      behavior: "smooth",
    });
  }, [activeIndex]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="video-view-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-[2px] sm:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl overflow-hidden rounded-clay-md border-2 border-clay-borderLight bg-white shadow-clay-lg"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b-[3px] border-clay-borderLight px-4 py-2.5 sm:px-5">
              <div className="flex min-w-0 items-center gap-2">
                <Sparkles size={18} className="shrink-0 text-clay-primary" />
                <h2 className="truncate text-sm font-extrabold text-clay-dark sm:text-base">
                  {title ? `Video: ${title}` : "Poin Penting Video"}
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Tutup tampilan video"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-clay-beige text-clay-muted transition-colors hover:text-red-500"
              >
                <X size={18} />
              </button>
            </div>

            {/* Konten: video + subtitle di kiri, poin di kanan */}
            <div className="grid lg:grid-cols-2">
              <div className="flex min-w-0 flex-col">
                <div className="bg-black">
                  <YoutubeEmbed
                    url={url}
                    title={title}
                    autoPlay
                    onIframeReady={setIframeEl}
                  />
                </div>

                {/* Panel subtitle claymorphism */}
                <div className="m-2 flex max-h-[38vh] flex-col overflow-hidden rounded-clay-md border-2 border-clay-borderLight bg-clay-beige shadow-clay-sm sm:m-3 lg:max-h-[32vh]">
                  <div
                    ref={subtitleScrollRef}
                    className="overflow-y-auto p-3 sm:p-4"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-clay-muted">
                        <Captions size={14} className="text-clay-primary" />
                        Subtitle
                        {subtitle.status === "success" &&
                          apiState === "ok" && (
                            <span className="rounded-clay-full bg-clay-primary/10 px-2 py-0.5 text-[10px] font-extrabold normal-case text-clay-primary">
                              sinkron dengan video
                            </span>
                          )}
                      </h3>
                      {subtitle.status === "success" && activeIndex >= 0 && (
                        <span className="text-[10px] font-bold tabular-nums text-clay-muted">
                          {formatTime(
                            subtitle.segments[activeIndex].offsetMs
                          )}
                        </span>
                      )}
                    </div>

                    {subtitle.status === "loading" && (
                      <div className="flex items-center gap-3 py-6 text-sm font-bold text-clay-muted">
                        <Loader2
                          size={16}
                          className="animate-spin text-clay-primary"
                        />
                        Memuat subtitle…
                      </div>
                    )}

                    {subtitle.status === "no-subtitle" && (
                      <div className="rounded-clay-md border-2 border-clay-borderLight bg-white/70 px-4 py-3 text-sm font-bold text-clay-muted">
                        Video ini tidak memiliki subtitle yang bisa ditampilkan.
                      </div>
                    )}

                    {subtitle.status === "error" && (
                      <div className="flex flex-col items-start gap-3 rounded-clay-md border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                        <span className="flex items-center gap-2">
                          <AlertTriangle size={16} className="shrink-0" />
                          {subtitle.error}
                        </span>
                        {subtitle.retryable && (
                          <button
                            onClick={() => void loadSubtitle()}
                            className="btn-clay-primary !min-h-[44px] !px-4 !py-2 text-xs"
                          >
                            <RefreshCw size={14} className="mr-1.5" />
                            Coba lagi
                          </button>
                        )}
                      </div>
                    )}

                    {subtitle.status === "success" && (
                      <>
                        {apiState === "loading" && (
                          <p className="mb-2 text-[11px] font-semibold text-clay-muted">
                            Menyiapkan sinkronisasi dengan video…
                          </p>
                        )}
                        {apiState === "unavailable" && (
                          <p className="mb-2 text-[11px] font-semibold text-clay-muted">
                            Sinkronisasi dengan video tidak tersedia — subtitle
                            tampil statis.
                          </p>
                        )}
                        <ol className="space-y-1">
                          {subtitle.segments.map((seg, i) => {
                            const active =
                              apiState === "ok" && i === activeIndex;
                            return (
                              <li key={i}>
                                <button
                                  type="button"
                                  disabled={apiState !== "ok"}
                                  onClick={() =>
                                    seekTo(seg.offsetMs / 1000)
                                  }
                                  data-active={active || undefined}
                                  aria-current={active ? "true" : undefined}
                                  title={
                                    apiState === "ok"
                                      ? "Lompat ke bagian ini"
                                      : undefined
                                  }
                                  className={`w-full rounded-clay-md px-3 py-1.5 text-left text-sm leading-relaxed transition-all duration-150 ${
                                    active
                                      ? "border-l-4 border-clay-primary bg-clay-primary/10 font-extrabold text-clay-dark shadow-clay-sm"
                                      : "border-l-4 border-transparent font-medium text-clay-muted hover:bg-white/70 hover:text-clay-dark"
                                  } ${
                                    apiState === "ok"
                                      ? "cursor-pointer"
                                      : "cursor-default"
                                  }`}
                                >
                                  <span className="mr-2 inline-block w-10 shrink-0 text-right text-[10px] font-bold tabular-nums text-clay-muted">
                                    {formatTime(seg.offsetMs)}
                                  </span>
                                  {seg.text}
                                </button>
                              </li>
                            );
                          })}
                        </ol>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Panel poin */}
              <div className="max-h-[45vh] overflow-y-auto border-t-2 border-clay-borderLight p-4 sm:p-5 lg:max-h-[60vh] lg:border-l-2 lg:border-t-0">
                <h3 className="mb-3 flex flex-wrap items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-clay-muted">
                  Poin-poin isi video
                  {points.status === "success" && (
                    <span className="rounded-clay-full bg-clay-primary/10 px-2 py-0.5 text-[10px] font-extrabold normal-case text-clay-primary">
                      dirangkum AI
                    </span>
                  )}
                </h3>

                {points.status === "loading" && (
                  <div className="flex items-center gap-3 py-8 text-sm font-bold text-clay-muted">
                    <Loader2
                      size={18}
                      className="animate-spin text-clay-primary"
                    />
                    Menyusun poin-poin…
                  </div>
                )}

                {points.status === "success" && (
                  <ul className="space-y-2.5">
                    {points.points.map((p, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 text-sm font-medium leading-relaxed text-clay-dark"
                      >
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-clay-primary" />
                        <span className="min-w-0 flex-1 break-words">{p}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {points.status === "error" && (
                  <div className="flex flex-col items-start gap-3 rounded-clay-md border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                    <span className="flex items-center gap-2">
                      <AlertTriangle size={16} className="shrink-0" />
                      {points.error}
                    </span>
                    {points.retryable && (
                      <button
                        onClick={() => void loadPoints()}
                        className="btn-clay-primary !min-h-[44px] !px-4 !py-2 text-xs"
                      >
                        <RefreshCw size={14} className="mr-1.5" />
                        Coba lagi
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
