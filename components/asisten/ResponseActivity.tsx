"use client";

export default function ResponseActivity({ thinking = "" }: { thinking?: string | null }) {
  return <div className="response-activity" role="status" aria-live="polite">
    <div className="response-activity-label">
      <span className="response-activity-orbit" aria-hidden="true"><i /><i /></span>
      <span className="response-activity-shimmer">{thinking ? "Momo sedang berpikir" : "Momo sedang menyusun jawaban"}</span>
    </div>
    {thinking && <div className="response-activity-thinking">{thinking}</div>}
  </div>;
}
