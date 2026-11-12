"use client";

import Globe from "kubai-icons-react/icons/globe";
import type { BrowserActivity } from "@/lib/study-browser";

export default function StudyBrowserPanel({ activities, busy }: { activities: BrowserActivity[]; busy: boolean }) {
  if (!activities.length) return null;
  const frame = activities.findLast(activity => activity.image);
  const current = activities.at(-1)!;
  return <details className="study-browser-panel" open>
    <summary><Globe size={18} aria-hidden="true" /><strong>Momo bekerja di browser</strong><span>{busy ? "Berlangsung" : current.label === "Penelusuran selesai" ? "Selesai" : "Berakhir"}</span></summary>
    <div className="study-browser-address">{current.url ? <a href={current.url} target="_blank" rel="noopener noreferrer">{current.url}</a> : current.label}</div>
    {frame?.image && <figure>
      {/* eslint-disable-next-line @next/next/no-img-element -- Authenticated ephemeral frame, never persisted or fetched through an image proxy. */}
      <img src={frame.image} alt={"Tangkapan browser Momo saat membaca " + (frame.url || "halaman")} />
      <figcaption>Gambar layar diperbarui setiap kali Momo membuka halaman.</figcaption>
    </figure>}
    <ol aria-label="Aktivitas browser">{activities.filter(activity => !activity.image).map((activity, index) => <li key={index}>{activity.label}</li>)}</ol>
  </details>;
}
