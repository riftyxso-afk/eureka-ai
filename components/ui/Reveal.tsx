"use client";

import { motion } from "framer-motion";

interface RevealProps {
  children: React.ReactNode;
  /** Penundaan animasi dalam detik — untuk efek berurutan (stagger). */
  delay?: number;
  className?: string;
}

/** Animasi masuk halus (fade + naik) untuk bagian halaman dashboard. */
export function Reveal({ children, delay = 0, className }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.32, 0.72, 0, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
