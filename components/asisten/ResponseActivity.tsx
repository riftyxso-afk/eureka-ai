"use client";

import { useEffect, useRef } from "react";
import ChatResponseLoader from "./ChatResponseLoader";
import type { LoadingStage } from "@/lib/loading-stage";

export default function ResponseActivity({ thinking = "", stage = "thinking", showIndicator = true }: {
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
    {showIndicator && <ChatResponseLoader stage={stage} />}
    {thinking && <div ref={thinkingRef} className="response-activity-thinking">{thinking}</div>}
  </div>;
}
