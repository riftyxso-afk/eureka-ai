"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { ArrowRight, X } from "lucide-react";
import "./call-intro-banner.css";

const SEEN_KEY = "eureka:call-intro:v1";
let shownInPage = false;

function hasSeenBanner() {
  try {
    return shownInPage || localStorage.getItem(SEEN_KEY) === "seen";
  } catch {
    return shownInPage;
  }
}

export default function CallIntroBanner({ onTry, paused }: { onTry: () => void; paused: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (paused || hasSeenBanner()) return;
    let timer: number;

    function showWhenReady() {
      const element = dialog.current;
      if (!element?.isConnected || hasSeenBanner()) return;
      if (document.visibilityState !== "visible" || document.querySelector("dialog[open]")) {
        timer = window.setTimeout(showWhenReady, 600);
        return;
      }

      element.showModal();
      shownInPage = true;
      try {
        localStorage.setItem(SEEN_KEY, "seen");
      } catch {
        // The in-memory flag still prevents repeat displays during navigation.
      }
    }

    timer = window.setTimeout(showWhenReady, 1400);
    return () => window.clearTimeout(timer);
  }, [paused]);

  function close() { dialog.current?.close(); }

  return <dialog ref={dialog} className="call-intro" aria-labelledby="call-intro-title" aria-describedby="call-intro-description">
    <div className="call-intro-art">
      <Image src="/brand/call-intro-orbs.webp" alt="" width={960} height={480} unoptimized loading="eager" />
      <button type="button" className="call-intro-close" aria-label="Tutup pengumuman" onClick={close}>
        <X size={20} aria-hidden="true" />
      </button>
    </div>
    <div className="call-intro-content">
      <span className="call-intro-badge">FITUR BARU</span>
      <h2 id="call-intro-title">Ngobrol langsung dengan Momo dan Lala</h2>
      <p id="call-intro-description">Tanya materi, cari info terbaru, atau minta Lala membuat catatan sambil ngobrol.</p>
      <div className="call-intro-actions">
        <button type="button" className="call-intro-try" data-eureka-sound="off" onClick={() => { close(); onTry(); }}>
          Coba sekarang <ArrowRight size={17} aria-hidden="true" />
        </button>
        <button type="button" className="call-intro-later" onClick={close}>Nanti saja</button>
      </div>
    </div>
  </dialog>;
}
