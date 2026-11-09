"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";

export default function SlideToConfirm({ label, busy, disabled, onConfirm }: {
  label: string; busy: boolean; disabled: boolean; onConfirm: () => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [limit, setLimit] = useState(0);
  const x = useMotionValue(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = track.current;
    if (!node) return;
    const measure = () => setLimit(Math.max(0, node.clientWidth - 56));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduce) {
      x.set(busy ? limit : 0);
      return;
    }
    const animation = animate(x, busy ? limit : 0, { type: "spring", stiffness: 460, damping: 37 });
    return () => animation.stop();
  }, [busy, limit, reduce, x]);

  return <div ref={track} className="pro-slide" aria-busy={busy}>
    <span aria-hidden="true">{label}</span>
    <motion.button type="button" className="pro-slide-thumb" aria-label={label} disabled={disabled}
      drag={disabled ? false : "x"} dragConstraints={{ left: 0, right: limit }}
      dragElastic={0} dragMomentum={false} style={{ x }}
      onDragEnd={event => {
        if (event.type !== "pointercancel" && limit > 0 && x.get() >= limit * .75) onConfirm();
        else if (reduce) x.set(0);
        else animate(x, 0, { type: "spring", stiffness: 460, damping: 37 });
      }}
      onClick={event => { if (event.detail === 0) onConfirm(); }}>
      <ArrowRight size={20} aria-hidden="true" />
    </motion.button>
  </div>;
}
