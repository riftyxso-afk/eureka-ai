"use client";

import { Loading, type LoadingAnimation } from "./loading";
import type { LoadingStage } from "@/lib/loading-stage";
import "./loading-status.css";

const animations: Record<LoadingStage, LoadingAnimation> = {
  combining: "bands",
  synchronizing: "orbit",
  reading: "register",
  retrieving: "beacon",
  thinking: "cells",
};

export default function LoadingStatus({ stage, detail, compact = false }: {
  stage: LoadingStage;
  detail?: string;
  compact?: boolean;
}) {
  return <span className="eureka-loading" data-stage={stage} role="status" aria-live="polite">
    <Loading animation={animations[stage]} size={compact ? 20 : 28} role="presentation" aria-hidden="true" />
    <span className="eureka-loading-copy">
      <span className="eureka-loading-label" key={stage}>{stage[0].toUpperCase() + stage.slice(1)}<span aria-hidden="true">…</span></span>
      {detail && <span className="eureka-loading-detail">{detail}</span>}
    </span>
  </span>;
}
