"use client";

import "./practice-motion.css";

export default function PracticeFeedback({
  outcome, correct, wrong, selfRated = false, ungraded = 0,
}: {
  outcome: "correct" | "wrong" | "complete";
  correct: number;
  wrong: number;
  selfRated?: boolean;
  ungraded?: number;
}) {
  const title = outcome === "complete" ? "Latihan selesai!"
    : outcome === "correct" ? selfRated ? "Satu lagi sudah kamu pahami!" : "Jawabanmu tepat!"
    : selfRated ? "Kita ulangi kartu ini nanti." : "Belum tepat. Yuk, pelajari alasannya.";

  return <div className="practice-feedback" data-outcome={outcome} role="status">
    <div className="practice-feedback-symbol" aria-hidden="true">
      <span className="practice-feedback-ring" />
      <i className="practice-feedback-mark-one" /><i className="practice-feedback-mark-two" />
      {outcome !== "wrong" && <span className="practice-feedback-particles">
        {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
      </span>}
    </div>
    <div className="practice-feedback-copy">
      <strong>{title}</strong>
      <div className="practice-feedback-tallies">
        <span data-result="correct"><b key={correct}>{correct}</b>{selfRated ? "Dipahami" : "Benar"}</span>
        <span data-result="wrong"><b key={wrong}>{wrong}</b>{selfRated ? "Perlu diulang" : "Salah"}</span>
        {ungraded > 0 && <span><b key={ungraded}>{ungraded}</b>Belum dinilai</span>}
      </div>
    </div>
  </div>;
}
