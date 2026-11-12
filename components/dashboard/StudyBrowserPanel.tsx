"use client";

import { useEffect, useRef, useState } from "react";
import Globe from "kubai-icons-react/icons/globe";
import X from "kubai-icons-react/icons/circle-x";
import type { BrowserActivity } from "@/lib/study-browser";
import StudyLiveView from "./StudyLiveView";

export default function StudyBrowserPanel({ activities, busy }: { activities: BrowserActivity[]; busy: boolean }) {
  const [viewing, setViewing] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (viewing && !dialog.current?.open) dialog.current?.showModal();
  }, [viewing]);
  if (!activities.length) return null;
  const current = activities.at(-1)!;
  return <section className="study-browser-panel" aria-label="Aktivitas browser Momo">
    <div className="study-browser-heading"><Globe size={18} aria-hidden="true" /><strong>Momo bekerja di browser</strong><button type="button" onClick={() => setViewing(true)}>View live ↗</button></div>
    <p className="study-browser-address" role="status">{busy ? current.label : current.label === "Penelusuran selesai" ? "Penelusuran selesai" : "Penelusuran berakhir"}</p>
    <details><summary>Lihat langkah penelusuran</summary><ol>{activities.map((activity, index) => <li key={index}>{activity.label}</li>)}</ol></details>
    <dialog ref={dialog} className="study-live-dialog" aria-labelledby="study-live-title" onClose={() => setViewing(false)} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <header><h2 id="study-live-title">Browser Momo · Live</h2><button type="button" aria-label="Tutup tampilan live" onClick={() => dialog.current?.close()}><X size={22} /></button></header>
      {viewing && <StudyLiveView />}
    </dialog>
  </section>;
}
