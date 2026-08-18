"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Tipe minimal YouTube IFrame API (hanya bagian yang kita pakai). */
interface YTPlayerLike {
  getCurrentTime(): number;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  playVideo(): void;
}

interface YTNamespaceLike {
  Player: new (
    element: HTMLElement,
    options: { events?: Record<string, (event: { data?: number }) => void> }
  ) => YTPlayerLike;
  ready(callback: () => void): void;
}

declare global {
  interface Window {
    YT?: YTNamespaceLike;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const YT_PLAYING = 1;
const YT_ENDED = 0;
const POLL_MS = 250;

let apiPromise: Promise<YTNamespaceLike | null> | null = null;

/**
 * Muat skrip IFrame API YouTube sekali (singleton) dari domain resmi.
 * Mengembalikan namespace YT, atau null bila gagal (jaringan/CSP/dll).
 */
function loadYoutubeIframeApi(): Promise<YTNamespaceLike | null> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }
    if (window.YT?.ready && window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const done = () => resolve(window.YT ?? null);
    // Dipasang SEBELUM skrip dimuat — YouTube memanggilnya saat API siap.
    window.onYouTubeIframeAPIReady = done;
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onload = () => {
      // Amankan bila callback di atas sudah terpanggil lebih dulu.
      if (window.YT?.ready) window.YT.ready(done);
      else setTimeout(done, 0);
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return apiPromise;
}

export type YoutubePlayerApiState = "loading" | "ok" | "unavailable";

export interface UseYoutubePlayerResult {
  /** Posisi pemutaran saat ini dalam detik (di-poll tiap 250 ms). */
  currentTime: number;
  /** Status ketersediaan IFrame API. */
  apiState: YoutubePlayerApiState;
  /** Apakah video sedang diputar (state PLAYING). */
  playing: boolean;
  /** Lompat ke detik tertentu lalu lanjutkan pemutaran. */
  seekTo: (seconds: number) => void;
}

/**
 * Sinkronisasi pemutaran video YouTube via IFrame API untuk panel subtitle:
 * membungkus iframe yang sudah ter-mount dengan YT.Player lalu mem-poll
 * getCurrentTime() tiap 250 ms. Polling berhenti saat video ENDED, saat
 * overlay tidak aktif, atau saat komponen di-unmount.
 */
export function useYoutubePlayer(
  videoId: string,
  iframeEl: HTMLIFrameElement | null,
  active: boolean
): UseYoutubePlayerResult {
  const [currentTime, setCurrentTime] = useState(0);
  const [apiState, setApiState] = useState<YoutubePlayerApiState>("loading");
  const [playing, setPlaying] = useState(false);
  const playerRef = useRef<YTPlayerLike | null>(null);
  const pollRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (player: YTPlayerLike) => {
      stopPolling();
      const read = () => {
        try {
          setCurrentTime(player.getCurrentTime() ?? 0);
        } catch {
          // Player belum siap — abaikan pembacaan ini.
        }
      };
      read();
      pollRef.current = window.setInterval(read, POLL_MS);
    },
    [stopPolling]
  );

  useEffect(() => {
    if (!active || !iframeEl) return;

    let cancelled = false;
    let player: YTPlayerLike | null = null;

    void loadYoutubeIframeApi().then((YT) => {
      if (cancelled) return;
      if (!YT) {
        setApiState("unavailable");
        return;
      }
      try {
        player = new YT.Player(iframeEl, {
          events: {
            onReady: () => {
              if (cancelled || !player) return;
              setApiState("ok");
              startPolling(player);
            },
            onStateChange: (e) => {
              const state = e?.data;
              setPlaying(state === YT_PLAYING);
              if (state === YT_ENDED) {
                setCurrentTime(0);
                stopPolling();
              } else if (state === YT_PLAYING && player && !cancelled) {
                startPolling(player);
              }
            },
          },
        });
        playerRef.current = player;
      } catch {
        setApiState("unavailable");
      }
    });

    return () => {
      cancelled = true;
      stopPolling();
      playerRef.current = null;
    };
  }, [active, iframeEl, videoId, startPolling, stopPolling]);

  const seekTo = useCallback((seconds: number) => {
    const p = playerRef.current;
    if (!p) return;
    try {
      p.seekTo(seconds, true);
      p.playVideo();
    } catch {
      // Player belum siap — abaikan.
    }
  }, []);

  return { currentTime, apiState, playing, seekTo };
}
