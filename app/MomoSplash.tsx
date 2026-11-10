"use client";

import { useEffect, useRef } from "react";

export default function MomoSplash() {
  const splash = useRef<HTMLDivElement>(null);
  const icon = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const overlay = splash.current;
    const mascot = icon.current;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const path = window.location.pathname.replace(/^\/(id|en)(?=\/)/, "").replace(/\/$/, "");
    if (!overlay || !mascot || motion.matches || path !== "/dashboard-v2") return;

    const elapsed = Number(overlay.getAnimations()[0]?.currentTime ?? 0);
    if (elapsed >= 580 || getComputedStyle(overlay).visibility === "hidden") return;

    let observer: MutationObserver | undefined;
    let timeout: number;
    let finished = false;
    const animations: Animation[] = [];
    function finish() {
      if (finished) return;
      finished = true;
      observer?.disconnect();
      window.clearTimeout(timeout);
      overlay!.dataset.state = "done";
      for (const animation of animations) animation.cancel();
    }

    function handoff() {
      const target = document.querySelector<HTMLElement>("[data-momo-splash-target]");
      if (!target || finished) return false;
      const from = mascot!.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      if (!to.width || !to.height || to.bottom <= 0 || to.top >= window.innerHeight) return false;

      observer?.disconnect();
      window.clearTimeout(timeout);
      const x = to.left + to.width / 2 - (from.left + from.width / 2);
      const y = to.top + to.height / 2 - (from.top + from.height / 2);
      const scale = Math.min(to.width, to.height) / from.width;
      const transform = `translate(${x}px, ${y}px) scale(${scale})`;
      const easing = getComputedStyle(overlay!).getPropertyValue("--ease-out").trim() || "cubic-bezier(.23, 1, .32, 1)";
      overlay!.dataset.state = "flying";
      const flight = mascot!.animate([
        { transform: "translate(0, 0) scale(1)", opacity: 1, easing },
        { transform, opacity: 1, offset: .78 },
        { transform, opacity: 0 },
      ], { duration: 440, fill: "forwards" });
      animations.push(flight, target.animate([
        { opacity: 0 }, { opacity: 0, offset: .7 }, { opacity: 1 },
      ], { duration: 440, fill: "both" }));
      void flight.finished.then(finish, finish);
      return true;
    }

    overlay.dataset.state = "waiting";
    timeout = window.setTimeout(() => {
      if (handoff()) return;
      observer = new MutationObserver(handoff);
      observer.observe(document.body, { childList: true, subtree: true });
      timeout = window.setTimeout(() => {
        observer?.disconnect();
        overlay.dataset.state = "fading";
        timeout = window.setTimeout(finish, 220);
      }, 700);
    }, Math.max(0, 400 - elapsed));

    window.addEventListener("resize", finish);
    window.addEventListener("scroll", finish, { passive: true });
    motion.addEventListener("change", finish);
    return () => {
      finish();
      delete overlay.dataset.state;
      window.removeEventListener("resize", finish);
      window.removeEventListener("scroll", finish);
      motion.removeEventListener("change", finish);
    };
  }, []);

  return <div className="momo-splash" ref={splash} aria-hidden="true">
    <span className="momo-splash-icon" ref={icon} />
  </div>;
}
