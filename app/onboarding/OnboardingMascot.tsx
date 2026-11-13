"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

type Mood = "wave" | "listen" | "think" | "celebrate";

export function MascotSlot({ mood, large = false, pose }: { mood: Mood; large?: boolean; pose?: string }) {
  return <div
    className={`onboarding-mascot-slot onboarding-mascot ${large ? "is-large" : ""}`}
    data-mascot-mood={mood}
    data-mascot-pose={pose ?? (mood === "think" ? "hadapi_sulit" : mood === "celebrate" ? "motivasi" : "name")}
    aria-hidden="true"
  />;
}

export default function OnboardingMascot() {
  const element = useRef<HTMLDivElement>(null);
  const flight = useRef<Animation | null>(null);
  const destination = useRef<HTMLElement | null>(null);
  const lastPosition = useRef("");
  const [character, setCharacter] = useState({ pose: "name", mood: "wave" });
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    const mascot = element.current;
    const container = mascot?.parentElement;
    if (!container || !mascot) return;
    let frame = 0;
    let visible = false;
    const resize = new ResizeObserver(schedule);

    function measure() {
      frame = 0;
      const target = container!.querySelector<HTMLElement>("[data-mascot-pose]");
      if (!target || !mascot) return;
      let x = 0;
      let y = 0;
      let parent: HTMLElement | null = target;
      while (parent && parent !== container) {
        x += parent.offsetLeft;
        y += parent.offsetTop;
        parent = parent.offsetParent as HTMLElement | null;
      }
      const width = target.offsetWidth;
      const height = target.offsetHeight;
      if (!width || !height) return;
      const pose = target.dataset.mascotPose || "name";
      const mood = target.dataset.mascotMood || "listen";
      setCharacter(previous => previous.pose === pose && previous.mood === mood ? previous : { pose, mood });

      const sceneChanged = destination.current !== target;
      const key = [x, y, width, height].join(",");
      if (!sceneChanged && key === lastPosition.current) return;
      if (destination.current) resize.unobserve(destination.current);
      destination.current = target;
      resize.observe(target);
      lastPosition.current = key;

      const bounds = mascot.getBoundingClientRect();
      const stageBounds = container!.getBoundingClientRect();
      const fromX = bounds.left - stageBounds.left;
      const fromY = bounds.top - stageBounds.top;
      const fromScale = bounds.width / 250;
      const toScale = Math.min(width, height) / 250;
      const targetX = x + (width - 250 * toScale) / 2;
      const targetY = y + (height - 250 * toScale) / 2;
      const end = `translate(${targetX}px, ${targetY}px) scale(${toScale}) rotate(0deg)`;
      flight.current?.cancel();
      mascot.style.transform = end;
      mascot.style.opacity = "1";
      if (!reduceMotion && visible) {
        const from = `translate(${fromX}px, ${fromY}px) scale(${fromScale}) rotate(0deg)`;
        const midY = Math.max(-20, Math.min(fromY, targetY) - (sceneChanged ? 54 : 12));
        const tilt = targetX >= fromX ? 12 : -12;
        const middle = `translate(${(fromX + targetX) / 2}px, ${midY}px) scale(${(fromScale + toScale) / 2}) rotate(${tilt}deg)`;
        mascot.dataset.flying = "true";
        const animation = mascot.animate([
          { transform: from },
          { transform: middle, offset: .45 },
          { transform: end },
        ], { duration: sceneChanged ? 620 : 220, easing: "cubic-bezier(.77,0,.175,1)" });
        flight.current = animation;
        animation.onfinish = () => { mascot.dataset.flying = "false"; };
      } else {
        mascot.dataset.flying = "false";
      }
      visible = true;
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(measure);
    }
    resize.observe(container);
    const observer = new MutationObserver(schedule);
    observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-mascot-pose", "data-mascot-mood"] });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      flight.current?.cancel();
      mascot.dataset.flying = "false";
      destination.current = null;
      lastPosition.current = "";
    };
  }, [reduceMotion]);

  return <div ref={element} className="onboarding-scene-mascot" aria-hidden="true">
    <div className="onboarding-mascot-trail"><i /><i /><i /></div>
    <div key={character.pose} className="onboarding-scene-character" data-pose={character.pose} data-mood={character.mood}>
      <Image src={`/onboarding/mascots/${character.pose}.webp`} alt="" width={250} height={250} loading="eager" unoptimized />
    </div>
  </div>;
}
