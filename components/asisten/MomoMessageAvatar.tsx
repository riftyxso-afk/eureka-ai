"use client";

import { useEffect, useRef } from "react";
import { chooseMomoLook, chooseMomoMood } from "@/lib/assistant/momo-reaction.mjs";

type Engine = typeof import("@/public/momo/engine/mesh.js");
let enginePromise: Promise<{ engine: Engine; renderer: import("@/public/momo/engine/mesh.js").MomoRenderer; palettes: Record<string, string> }> | undefined;
const pictures = new Map<string, string>();

function getEngine() {
  if (!enginePromise) enginePromise = Promise.all([
    import("@/public/momo/engine/mesh.js"),
    import("@/public/momo/looks.js"),
  ]).then(([engine, looks]) => {
    const renderer = engine.createRenderer({ base: "/momo" });
    renderer.preload();
    return { engine, renderer, palettes: looks.LOOK_PALETTE };
  }).catch((error) => { enginePromise = undefined; throw error; });
  return enginePromise;
}

export default function MomoMessageAvatar({ question = "", response = "", thinking = false }: { question?: string; response?: string; thinking?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visibleLook = useRef<string | null>(null);
  const transition = useRef<Animation | null>(null);
  const look = chooseMomoLook(question, response);
  const mood = chooseMomoMood(response, { thinking });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const key = `${look}:${mood}`;
    const paint = (source: CanvasImageSource) => {
      if (cancelled) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const update = () => { ctx.clearRect(0, 0, 96, 96); ctx.drawImage(source, 0, 0, 96, 96); visibleLook.current = look; };
      const changed = visibleLook.current !== null && visibleLook.current !== look;
      transition.current?.cancel();
      if (!changed || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { update(); return; }
      const outgoing = canvas.animate([{ transform: "perspective(400px) rotateY(0deg)" }, { transform: "perspective(400px) rotateY(90deg)" }], { duration: 180, easing: "ease-in", fill: "forwards" });
      transition.current = outgoing;
      void outgoing.finished.then(() => {
        if (cancelled) return;
        update();
        const incoming = canvas.animate([{ transform: "perspective(400px) rotateY(-90deg)" }, { transform: "perspective(400px) rotateY(0deg)" }], { duration: 220, easing: "ease-out" });
        transition.current = incoming;
        outgoing.cancel();
      }).catch(() => {});
    };
    const paintCached = (url: string) => {
      const image = new Image();
      image.onload = () => paint(image);
      image.src = url;
    };
    const cached = pictures.get(key);
    if (cached) paintCached(cached);
    else void getEngine().then(({ engine, renderer, palettes }) => {
      let attempts = 0;
      const draw = () => {
        if (cancelled) return;
        const outfit = engine.OUTFITS[look] ?? 0;
        const frame = document.createElement("canvas");
        frame.width = frame.height = 96;
        if (renderer.isReady(outfit) && renderer.draw(frame, 96, {
          outfit, face: engine.FACE[look] ?? 0,
          palette: look === "rest" ? "persimmon" : (palettes[look] || "persimmon"),
          restMouth: true, look: [0, 0], smile: mood === "happy" ? .8 : 0,
          brows: mood === "concerned" ? [.035, .04, .04, .035] : [0, 0, 0, 0],
        })) {
          pictures.set(key, frame.toDataURL());
          paint(frame);
        } else if (++attempts < 120) timer = setTimeout(draw, 150);
      };
      draw();
    }).catch(() => {});
    return () => { cancelled = true; if (timer) clearTimeout(timer); transition.current?.cancel(); };
  }, [look, mood]);

  return <canvas ref={canvasRef} width={96} height={96} className="momo-message-avatar" aria-hidden="true" />;
}
