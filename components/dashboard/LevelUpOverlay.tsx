"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Flame } from "lucide-react";
import { LEVEL_UP_EVENT } from "@/lib/levelUp";
import { playLevelUpSound } from "@/lib/notifySound";

interface PendingLevelUp {
  level: number;
  at: number;
}

export default function LevelUpOverlay() {
  const [pending, setPending] = useState<PendingLevelUp | null>(null);

  useEffect(() => {
    const onLevelUp = (e: Event) => {
      const detail = (e as CustomEvent<{ level: number }>).detail;
      const level = Number(detail?.level);
      if (!Number.isFinite(level) || level <= 1) return;
      setPending({ level, at: Date.now() });
      playLevelUpSound();
    };
    window.addEventListener(LEVEL_UP_EVENT, onLevelUp);
    return () => window.removeEventListener(LEVEL_UP_EVENT, onLevelUp);
  }, []);

  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setPending(null), 3600);
    return () => clearTimeout(t);
  }, [pending]);

  return (
    <AnimatePresence>
      {pending && (
        <motion.div
          key={pending.at}
          className="fixed inset-0 z-[80] overflow-y-auto bg-clay-dark/40 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setPending(null)}
        >
          <div className="flex min-h-full items-center justify-center p-4">
            <motion.div
              className="relative flex flex-col items-center px-6"
              initial={{ scale: 0.6, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 1.1, opacity: 0, y: -40 }}
              transition={{ type: "spring", stiffness: 200, damping: 16 }}
            >
              <motion.div
                className="relative"
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
              >
                <motion.span
                  className="absolute inset-0 rounded-full bg-orange-400/50 blur-2xl"
                  animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0.9, 0.6] }}
                  transition={{ repeat: Infinity, duration: 1.4 }}
                />
                <span className="relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 shadow-[0_0_60px_rgba(251,146,60,0.65)]">
                  <Flame size={56} className="text-white drop-shadow" />
                </span>
                {Array.from({ length: 7 }).map((_, i) => (
                  <motion.span
                    key={i}
                    className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-amber-300"
                    initial={{ x: 0, y: 0, opacity: 0 }}
                    animate={{
                      x: Math.cos((i / 7) * Math.PI * 2) * 70,
                      y: Math.sin((i / 7) * Math.PI * 2) * 70 - 20,
                      opacity: [0, 1, 0],
                      scale: [0.4, 1.1, 0.2],
                    }}
                    transition={{
                      duration: 1.1,
                      delay: i * 0.12,
                      repeat: Infinity,
                      repeatDelay: 0.6,
                    }}
                  />
                ))}
              </motion.div>

              <motion.div
                className="card-clay mt-6 !bg-white/95 px-10 py-6 text-center !shadow-none"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.25 }}
              >
                <p className="text-xs font-extrabold uppercase tracking-widest text-clay-muted">
                  Target XP tercapai
                </p>
                <motion.p
                  className="mt-1 text-3xl font-extrabold text-clay-dark"
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.35, type: "spring", stiffness: 260 }}
                >
                  Level {pending.level}!
                </motion.p>
                <p className="mt-2 text-sm font-bold text-clay-muted">
                  Streak-mu makin membara. Lanjutkan!
                </p>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
