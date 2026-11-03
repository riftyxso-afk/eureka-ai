"use client";

import { useEffect, useRef, useState } from "react";
import { chooseMomoLook, chooseMomoMood } from "@/lib/assistant/momo-reaction.mjs";

export type MomoMode = "fast" | "normal" | "deep";
type Props = { question?: string; response?: string; thinking?: boolean; error?: boolean; className?: string; mode?: MomoMode };

export default function MomoCompanion({ question = "", response = "", thinking = false, error = false, className = "", mode }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const previousMode = useRef(mode);
  const modeReaction = useRef<{ mode: MomoMode; started: number } | null>(null);
  const lastResponse = useRef("");
  const state = useRef({ look: chooseMomoLook("", "", mode), mood: "neutral", changedAt: 0 });
  const spin = useRef<{ from: string; to: string; started: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const detectedMood = chooseMomoMood(response, { thinking, error });
  const mood = detectedMood === "neutral" && response.trim() ? "answering" : detectedMood;

  useEffect(() => {
    const now = performance.now();
    const modeChanged = previousMode.current !== mode;
    if (modeChanged && mode) modeReaction.current = { mode, started: now };
    const responseKey = `${question}\u0000${response}`;
    const responseCompleted = !thinking && !error && response.trim().length > 0 && lastResponse.current !== responseKey;
    let look = state.current.look;
    if (modeChanged) look = chooseMomoLook("", "", mode);
    else if (responseCompleted) look = chooseMomoLook(question, response, mode);
    if (responseCompleted) lastResponse.current = responseKey;
    if (look !== state.current.look) {
      const active = spin.current;
      const visibleLook = active && now - active.started < 475 ? active.from : state.current.look;
      spin.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? null : { from: visibleLook, to: look, started: now };
    }
    previousMode.current = mode;
    state.current = { look, mood, changedAt: now };
  }, [question, mood, mode, response, thinking, error]);
  useEffect(() => {
    let disposed = false;
    let raf = 0;
    let observer: ResizeObserver | undefined;
    let renderer: import("@/public/momo/engine/mesh.js").MomoRenderer | undefined;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const root = container.current;
    let mesh: typeof import("@/public/momo/engine/mesh.js");
    let palettes: Record<string, string>;
    let last = 0;
    let expression = { smile: 0, gazeX: 0, gazeY: 0, brow: 0, widen: 0, tilt: 0 };
    let rendered = false;
    const fallbackTimer = window.setTimeout(() => { if (!disposed && !rendered) setFailed(true); }, 12000);
    let lastSignature = "";
    let lastDrawn = "";

    const frame = (now: number) => {
      raf = 0;
      if (disposed || document.hidden || !renderer || !root) return;
      const { mood: currentMood } = state.current;
      const activeSpin = spin.current;
      const progress = activeSpin ? Math.min(1, (now - activeSpin.started) / 950) : 1;
      const currentLook = activeSpin && progress < .5 ? activeSpin.from : state.current.look;
      const eased = progress < .5 ? 4 * progress ** 3 : 1 - ((-2 * progress + 2) ** 3) / 2;
      const yaw = activeSpin && !reduced.matches ? eased * Math.PI * 2 : 0;
      if (activeSpin && progress >= 1) spin.current = null;
      const signature = `${currentLook}:${currentMood}:${root.clientWidth}:${root.clientHeight}`;
      if (!last || now - last >= 34 || signature !== lastDrawn) {
        const time = now / 1000;
        const age = Math.max(0, (now - state.current.changedAt) / 1000);
        const reaction = modeReaction.current;
        const reactionAge = reaction ? (now - reaction.started) / 1000 : Infinity;
        const reactionStrength = !reduced.matches && reactionAge >= 0 && reactionAge < 2
          ? Math.min(1, reactionAge / .22, (2 - reactionAge) / .45)
          : 0;
        const powerful = reaction?.mode === "deep" ? reactionStrength : 0;
        const lively = reaction?.mode === "fast" ? reactionStrength : 0;
        const calm = reaction?.mode === "normal" ? reactionStrength : 0;
        const reacting = currentMood === "thinking" || ((currentMood === "happy" || currentMood === "answering") && age < 3.2);
        const moving = !reduced.matches;
        const dt = last ? Math.min((now - last) / 1000, .1) : .034;
        const blend = moving ? 1 - Math.exp(-dt * 7) : 1;
        const targets = {
          smile: Math.max(currentMood === "happy" ? .8 : currentMood === "answering" ? .35 : 0, powerful * .72, lively * .85, calm * .5),
          gazeX: currentMood === "thinking" ? .15 + (moving ? Math.sin(time * 1.15) * .07 : 0) : moving ? Math.sin(time * .55) * .025 : 0,
          gazeY: currentMood === "thinking" ? .13 : currentMood === "concerned" ? -.035 : 0,
          brow: powerful * .06 + (currentMood === "concerned" ? .035 : currentMood === "thinking" ? .018 : currentMood === "happy" ? .025 : 0),
          widen: Math.max(currentMood === "happy" ? .08 : currentMood === "thinking" ? .035 : 0, powerful * .14, lively * .1),
          tilt: powerful ? Math.sin(reactionAge * 8) * .045 * powerful : lively ? Math.sin(reactionAge * 10) * .07 * lively : currentMood === "concerned" ? -.035 : currentMood === "thinking" && moving ? Math.sin(time * 1.6) * .06 : 0,
        };
        expression = {
          smile: expression.smile + (targets.smile - expression.smile) * blend,
          gazeX: expression.gazeX + (targets.gazeX - expression.gazeX) * blend,
          gazeY: expression.gazeY + (targets.gazeY - expression.gazeY) * blend,
          brow: expression.brow + (targets.brow - expression.brow) * blend,
          widen: expression.widen + (targets.widen - expression.widen) * blend,
          tilt: expression.tilt + (targets.tilt - expression.tilt) * blend,
        };
        const size = Math.min(450, Math.max(120, Math.round(Math.max(root.clientWidth, root.clientHeight) * Math.min(window.devicePixelRatio, 1.5))));
        const phase = time % 5.2;
        const image = renderer.draw(null, size, {
          outfit: mesh.OUTFITS[currentLook] ?? 0,
          face: mesh.FACE[currentLook] ?? 0,
          palette: currentLook === "rest" ? "persimmon" : (palettes[currentLook] || "persimmon"),
          restMouth: true,
          time,
          yaw,
          blink: reduced.matches ? 0 : phase < .14 ? Math.sin(phase / .14 * Math.PI) : 0,
          squash: reduced.matches ? 0 : Math.sin(time * (reacting ? 5 : 1.6)) * (reacting ? .14 : .035) + (reactionStrength ? Math.sin(reactionAge * 9) * (powerful * .12 + lively * .08) : 0),
          roll: moving ? expression.tilt + (reacting ? Math.sin(time * 3) * .07 : Math.sin(time * 1.1) * .015) : 0,
          look: [expression.gazeX, expression.gazeY],
          smile: Math.min(1, expression.smile + (moving && reacting && currentMood === "answering" ? Math.abs(Math.sin(time * 5)) * .25 : 0)),
          brows: [expression.brow, expression.brow * 1.1, expression.brow * 1.1, expression.brow],
          eyeScale: [1 + expression.widen, 1 + expression.widen],
          lids: moving && currentMood === "happy" && age > .5 && age < .8 ? [Math.sin((age - .5) / .3 * Math.PI), 0] : [0, 0],
          wink: moving && currentMood === "happy" && age > .5 && age < .8 ? Math.sin((age - .5) / .3 * Math.PI) : 0,
        });
        if (image) { if (!rendered) { rendered = true; setReady(true); setFailed(false); window.clearTimeout(fallbackTimer); } lastDrawn = signature; }
        last = now;
      }
      // Reduced motion keeps a still frame, but continues until meshes load or the expression changes.
      if (!reduced.matches || lastDrawn !== signature) raf = requestAnimationFrame(frame);
    };
    const wake = () => { if (!disposed && !raf && !document.hidden) raf = requestAnimationFrame(frame); };
    const timer = window.setInterval(() => {
      const current = `${state.current.look}:${state.current.mood}:${root?.clientWidth}:${root?.clientHeight}`;
      if (current !== lastSignature) { lastSignature = current; wake(); }
    }, 150);
    const start = async () => {
      try {
        const [meshModule, canvasModule, lookModule] = await Promise.all([
          import("@/public/momo/engine/mesh.js"),
          import("@/public/momo/engine/canvas.js"),
          import("@/public/momo/looks.js"),
        ]);
        if (disposed || !root) return;
        mesh = meshModule;
        palettes = lookModule.LOOK_PALETTE;
        try { renderer = meshModule.createRenderer({ base: "/momo" }); }
        catch { renderer = canvasModule.createRenderer({ base: "/momo" }); }
        renderer.canvas.setAttribute("aria-hidden", "true");
        root.appendChild(renderer.canvas);
        renderer.preload();
        observer = new ResizeObserver(wake);
        observer.observe(root);
        wake();
      } catch { if (!disposed) setFailed(true); }
    };
    void start();
    document.addEventListener("visibilitychange", wake);
    reduced.addEventListener("change", wake);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.clearTimeout(fallbackTimer);
      cancelAnimationFrame(raf);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", wake);
      reduced.removeEventListener("change", wake);
      renderer?.gl?.getExtension("WEBGL_lose_context")?.loseContext();
      renderer?.canvas.remove();
    };
  }, []);
  return <div className={`momo-companion ${className}`}>
    <div ref={container} className="momo-canvas-mount" aria-hidden="true" />
    {!ready && failed && <span className="momo-companion-loading" role="status">Momo belum dapat dimuat</span>}
  </div>;
}
