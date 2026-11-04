"use client";

import { useEffect, useRef } from "react";

export default function ResponseActivity({ thinking = "" }: { thinking?: string | null }) {
  const thinkingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = thinkingRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [thinking]);

  return <div className="response-activity">
    <div className="response-activity-label" role="status">
      <span className="response-activity-orbit" aria-hidden="true"><i /><i /></span>
      <span className="response-activity-shimmer">{thinking ? "Momo sedang berpikir" : "Momo sedang menyusun jawaban"}</span>
    </div>
    {thinking && <div ref={thinkingRef} className="response-activity-thinking">{thinking}</div>}
  </div>;
}
