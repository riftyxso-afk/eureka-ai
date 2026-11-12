"use client";

import { useEffect, useRef, useState } from "react";
import Monitor from "kubai-icons-react/icons/monitor";
import ChevronDown from "kubai-icons-react/icons/chevron-down";
import X from "kubai-icons-react/icons/circle-x";
import type { BrowserActivity } from "@/lib/study-browser";
import StudyLiveView from "./StudyLiveView";

export default function StudyBrowserPanel({ activities, busy }: { activities: BrowserActivity[]; busy: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.show(); }, []);
  if (!activities.length) return null;
  const current = activities.at(-1)!;
  function expand() {
    const element = dialog.current;
    if (!element) return;
    element.close();
    element.showModal();
    setExpanded(true);
  }
  return <section className="study-browser-panel" aria-label="Computer Use">
    <div className="study-browser-heading"><Monitor color="#8253d4" size={20} aria-hidden="true" /><strong>Computer Use</strong><button type="button" onClick={expand}>View live ↗</button></div>
    <p className="study-browser-address" role="status">{busy ? current.label : current.label === "Penelusuran selesai" ? "Penelusuran selesai" : "Penelusuran berakhir"}</p>
    <dialog ref={dialog} className={expanded ? "study-live-dialog" : "study-live-inline"} aria-label="Computer Use live" onClose={() => {
      const element = dialog.current;
      if (element && !element.open) { setExpanded(false); element.show(); }
    }} onClick={event => { if (expanded && event.target === event.currentTarget) dialog.current?.close(); }}>
      {expanded && <header><h2>Computer Use · Live</h2><button type="button" aria-label="Tutup tampilan live" onClick={() => dialog.current?.close()}><X size={22} /></button></header>}
      <StudyLiveView />
    </dialog>
    <details><summary><span>Lihat langkah penelusuran</span><ChevronDown size={15} aria-hidden="true" /></summary><ol>{activities.map((activity, index) => <li key={index}>{activity.label}</li>)}</ol></details>
  </section>;
}
