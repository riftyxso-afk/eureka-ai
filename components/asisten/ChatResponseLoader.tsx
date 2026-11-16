"use client";

import dynamic from "next/dynamic";
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

export default function ChatResponseLoader({ stage, detail }: { stage: LoadingStage; detail?: string }) {
  return <div role="status" aria-live="polite" data-stage={stage}
    style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 48, background: "transparent", border: 0, boxShadow: "none" }}>
    <FluidMorphOrb variant="fluid" size={44} speed={stage === "combining" ? 1.15 : 0.75} />
    <span className="ai-status-shimmer" style={{ fontSize: 13, lineHeight: 1.6 }}>{detail || labels[stage]}…</span>
  </div>;
}
