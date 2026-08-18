"use client";

import { useState } from "react";
import { Eye, Play } from "lucide-react";
import { extractYoutubeVideoId } from "@/lib/assistant/videoUrl";

interface YoutubeEmbedProps {
  url: string;
  /** Judul video (opsional) — dipakai aria-label & title iframe. */
  title?: string;
  className?: string;
  /** Saat ada, tombol "View" tampil di pojok kanan atas untuk membuka tampilan expand. */
  onView?: (url: string) => void;
  /** Langsung putar (iframe autoplay) saat dirender — dipakai overlay View. */
  autoPlay?: boolean;
  /** Dipanggil saat iframe pemutar ter-mount — untuk integrasi IFrame API (sinkronisasi subtitle). */
  onIframeReady?: (iframe: HTMLIFrameElement) => void;
}

/**
 * Player video YouTube click-to-play: thumbnail + tombol play dulu, iframe
 * (youtube-nocookie, mode privasi) baru dimuat setelah diklik. ID video tidak
 * valid → render null. Opsional tombol "View" (pojok kanan atas) untuk
 * membuka tampilan expand dengan poin-poin isi video.
 */
export function YoutubeEmbed({
  url,
  title,
  className = "",
  onView,
  autoPlay = false,
  onIframeReady,
}: YoutubeEmbedProps) {
  const [playing, setPlaying] = useState(autoPlay);
  const videoId = extractYoutubeVideoId(url);
  if (!videoId) return null;

  return (
    <div
      className={`relative overflow-hidden rounded-clay-md border-2 border-clay-borderLight bg-clay-beige shadow-clay-sm ${className}`}
    >
      {playing ? (
        <div className="aspect-video w-full">
          <iframe
            ref={(el) => {
              if (el && onIframeReady) onIframeReady(el);
            }}
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&enablejsapi=1`}
            title={title ? `Video: ${title}` : "Video YouTube"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={title ? `Putar video: ${title}` : "Putar video YouTube"}
          className="group relative block w-full cursor-pointer bg-black"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
            alt={title ? `Thumbnail video: ${title}` : "Thumbnail video YouTube"}
            className="aspect-video w-full object-cover opacity-90 transition-opacity duration-75 group-hover:opacity-75"
            loading="lazy"
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-clay-lg transition-transform duration-75 group-hover:scale-110 group-active:scale-95">
              <Play size={24} className="ml-0.5 fill-current" />
            </span>
          </span>
        </button>
      )}

      {onView && (
        <button
          type="button"
          onClick={() => onView(url)}
          aria-label="Lihat poin-poin isi video"
          className="absolute right-2 top-2 z-10 inline-flex min-h-[44px] items-center gap-1.5 rounded-clay-full bg-black/60 px-3 py-2 text-xs font-extrabold text-white shadow-clay-sm backdrop-blur-[2px] transition-colors hover:bg-black/80"
        >
          <Eye size={14} />
          View
        </button>
      )}
    </div>
  );
}
