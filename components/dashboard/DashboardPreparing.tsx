"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

/**
 * Layar "Menyiapkan dashboardmu..." — muncul setelah onboarding selesai,
 * lalu memudar halus untuk memperlihatkan dashboard di baliknya.
 */
export function DashboardPreparing() {
  return (
    <motion.div
      key="dashboard-preparing"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-clay-beige"
      role="status"
      aria-live="polite"
    >
      {/* Blob dekoratif lembut */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-clay-primary/10" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-clay-secondary/10" />

      <motion.div
        initial={{ scale: 0.94, y: 14 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
        className="relative z-10 mx-4 w-full max-w-sm rounded-clay border-3 border-clay-borderLight bg-white p-8 text-center shadow-clay-lg"
      >
        <div className="relative mx-auto h-20 w-20">
          <div className="absolute inset-0 animate-ping rounded-full bg-clay-primary/20" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Logo Eureka.AI"
            className="relative h-20 w-20 object-contain"
          />
        </div>

        <h2 className="mt-5 text-xl font-extrabold text-clay-dark sm:text-2xl">
          Menyiapkan dashboardmu...
        </h2>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-sm font-bold text-clay-muted">
          <Sparkles size={15} className="text-clay-primary" />
          Menata catatan, progres & levelmu
        </p>

        <div className="mt-6 h-4 w-full overflow-hidden rounded-clay-full border-2 border-clay-borderLight bg-clay-inputBg">
          <div className="relative h-full overflow-hidden rounded-clay-full bg-gradient-to-r from-clay-primary via-clay-secondary to-clay-primary">
            <motion.div
              className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/60 to-transparent"
              animate={{ x: ["-100%", "300%"] }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </div>
        </div>

        <p className="mt-3 text-xs font-bold text-clay-muted">
          Sebentar lagi, semuanya siap
        </p>
      </motion.div>
    </motion.div>
  );
}
