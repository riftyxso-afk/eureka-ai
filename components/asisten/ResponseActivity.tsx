"use client";

import { useEffect, useRef } from "react";
import type { LoadingStage } from "@/lib/loading-stage";
import ConnectorCalls from "./ConnectorCalls";
import type { ConnectorCall } from "@/lib/connectors/events";

export default function ResponseActivity({ thinking = "", stage = "thinking", showIndicator = true, toolCalls = [] }: {
  toolCalls?: ConnectorCall[];
  thinking?: string | null;
  stage?: LoadingStage;
  showIndicator?: boolean;
}) {
  const thinkingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = thinkingRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [thinking]);

  if (!showIndicator && !thinking) return null;
  return <div className="response-activity">
    {showIndicator && <ConnectorCalls calls={toolCalls} streaming stage={stage} />}
    {thinking && <div ref={thinkingRef} className="response-activity-thinking">{thinking}</div>}
  </div>;
}
