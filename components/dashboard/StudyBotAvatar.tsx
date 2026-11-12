"use client";

import { useEffect, useRef, useState } from "react";
import type { MountedAvatar } from "open-bot-avatar/dom";

type Props = { prompt?: string; response?: string; stage?: string; busy?: boolean; error?: boolean; size?: number; still?: boolean };

export default function StudyBotAvatar({ prompt = "", response = "", stage, busy = false, error = false, size = 76, still = false }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const avatar = useRef<MountedAvatar | null>(null);
  const [ready, setReady] = useState(false);
  const [reaction, setReaction] = useState(false);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = response.slice(-500);
  const positive = /\b(berhasil|selamat|tepat|benar|terima kasih|bagus)\b/i.test(latest);
  const sensitive = error || /\b(sedih|bingung|kesulitan|duka|gagal)\b/i.test(latest || prompt);
  const mood = busy && !response ? "thinking" : !sensitive && (reaction || positive || (!busy && Boolean(response))) ? "happy" : "idle";
  const words = response.trim() ? response.trim().split(/\s+/).length : 0;

  useEffect(() => {
    let disposed = false;
    const target = host.current;
    void Promise.all([import("open-bot-avatar"), import("open-bot-avatar/dom")]).then(([core, dom]) => {
      if (disposed || !target) return;
      avatar.current = dom.mountAvatar(target, {
        definition: core.getExample("chat")!, color: "#9565dc", eyeColor: "#261b3a",
        followPointer: !still, still, reducedMotion: "system", label: "Momo",
      });
      setReady(true);
    }).catch(() => {});
    return () => { disposed = true; avatar.current?.destroy(); avatar.current = null; clearTimeout(reactionTimer.current); };
  }, [still]);

  useEffect(() => {
    const lookAt = stage === "retrieving" ? { x: .55, y: -.1 } : stage === "reading" ? { x: -.25, y: .35 } : undefined;
    const view = busy && words > 0 ? { yaw: Math.sin(words * .32) * .12, pitch: Math.cos(words * .18) * .05 } : undefined;
    avatar.current?.update({ mood, lookAt, view, followPointer: !still && !busy, still });
  }, [ready, mood, stage, words, busy, still]);

  const label = error ? "Momo menemui kendala" : busy ? response ? "Momo sedang menjawab" : stage === "reading" ? "Momo sedang membaca" : stage === "retrieving" ? "Momo sedang mencari" : "Momo sedang berpikir" : "Momo siap membantu";
  return <div className="study-bot-avatar" style={{ width: size, height: size }} data-mood={mood} data-stage={stage || "idle"}>
    <div ref={host} className="study-bot-avatar-render" aria-hidden="true" />
    {!ready && <span className="study-bot-fallback" aria-hidden="true">●</span>}
    {!still && <button type="button" aria-label={label + ". Sapa Momo"} onClick={() => {
      setReaction(true); clearTimeout(reactionTimer.current); reactionTimer.current = setTimeout(() => setReaction(false), 1800);
    }} />}
  </div>;
}
