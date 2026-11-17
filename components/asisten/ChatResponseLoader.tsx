"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { LoadingStage } from "@/lib/loading-stage";
import "@/components/ui/loading-status.css";

const FluidMorphOrb = dynamic(() => import("@/components/ui/FluidMorphOrb"), { ssr: false });

const labels: Record<LoadingStage, string> = {
  synchronizing: "Menyiapkan percakapan",
  retrieving: "Mencari sumber",
  reading: "Membaca sumber",
  thinking: "Memikirkan jawaban",
  combining: "Menyusun jawaban",
};

export default function ChatResponseLoader({ stage, detail, icon, iconKey = "orb", busy = true }: { stage: LoadingStage; detail?: string; icon?: ReactNode; iconKey?: string; busy?: boolean }) {
  const reduced = useReducedMotion();
  return <div role="status" aria-live="polite" data-stage={stage}
    style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 48, background: "transparent", border: 0, boxShadow: "none" }}>
    <span style={{position:"relative",display:"inline-grid",placeItems:"center",width:44,height:44,flexShrink:0}}>
      <AnimatePresence initial={false}>
        <motion.span key={iconKey} style={{position:"absolute",display:"grid",placeItems:"center",inset:0}}
          initial={{opacity:0,...(!reduced?{scale:.85,filter:"blur(4px)"}:{})}}
          animate={{opacity:1,...(!reduced?{scale:1,filter:"blur(0px)"}:{})}}
          exit={{opacity:0,...(!reduced?{scale:.85,filter:"blur(4px)"}:{})}}
          transition={{duration:reduced ? 0.1 : 0.24,ease:[.2,0,0,1]}}>
          {icon || <FluidMorphOrb variant="fluid" size={44} speed={stage === "combining" ? 1.15 : 0.75} />}
        </motion.span>
      </AnimatePresence>
    </span>
    <span className={busy ? "ai-status-shimmer" : ""} style={{ fontSize: 13, lineHeight: 1.6 }}>{detail || labels[stage]}{detail ? "" : "…"}</span>
  </div>;
}
