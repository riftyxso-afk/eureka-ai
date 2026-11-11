"use client";

import { useEffect, useRef } from "react";
import "./call-aurora.css";

export default function CallAurora({ phase, level }: { phase: string; level: () => number }) {
  const aurora = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = aurora.current;
    if (!element || phase !== "speaking") return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let energy = 0;
    let previousTime = performance.now();

    function reset() {
      cancelAnimationFrame(frame);
      element?.style.removeProperty("transform");
      element?.style.removeProperty("opacity");
    }

    function animate(now: number) {
      const target = level();
      const elapsed = Math.min(64, now - previousTime);
      previousTime = now;
      const responseTime = target > energy ? 65 : 180;
      energy += (target - energy) * (1 - Math.exp(-elapsed / responseTime));
      if (element) {
        element.style.opacity = (0.34 + energy * 0.62).toFixed(3);
        element.style.transform = `translate3d(${energy * -3}%, ${energy * -4}%, 0) scale(${1 + energy * 0.18}) rotate(${energy * 5}deg)`;
      }
      frame = requestAnimationFrame(animate);
    }

    function syncMotion() {
      reset();
      energy = 0;
      previousTime = performance.now();
      if (!reducedMotion.matches) frame = requestAnimationFrame(animate);
    }

    syncMotion();
    reducedMotion.addEventListener("change", syncMotion);
    return () => {
      reducedMotion.removeEventListener("change", syncMotion);
      reset();
    };
  }, [level, phase]);

  return <div className="call-aurora" data-phase={phase} ref={aurora} aria-hidden="true" />;
}
