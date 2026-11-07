"use client";

import { useEffect, useRef } from "react";
import { PODCAST_HOSTS } from "@/lib/podcastHosts";
import "./podcast-studio.css";

const POSITIONS: Record<string, string> = { momo: "0% 0%", nara: "100% 0%", lumi: "0% 100%", ara: "100% 100%" };

export function PodcastPortrait({ host, className = "" }: { host: string; className?: string }) {
  return <span className={`ps-portrait ${className}`} aria-hidden="true" style={{ backgroundPosition: POSITIONS[host] ?? POSITIONS.momo }} />;
}

export default function PodcastStudio({ hosts, activeHost, playing, stage, ready, level, reduced, editingSeat, onSeatPick }: {
  hosts: string[]; activeHost?: string; playing: boolean; stage: "idle" | "script" | "audio"; ready: boolean; level: () => number; reduced: boolean; editingSeat?: number; onSeatPick?: (index: number) => void;
}) {
  const actors = useRef<(HTMLDivElement | null)[]>([]);
  const hostKey = hosts.join(":");
  useEffect(() => {
    const nodes = actors.current;
    let frame = 0; let energy = 0;
    if (playing && !reduced) {
      const update = () => {
        energy += (level() - energy) * .24;
        nodes.forEach((node, index) => {
          if (!node) return;
          const amount = hosts[index] === activeHost ? energy : 0;
          node.style.transform = `translateY(${-amount * 2}px) scale(${1 + amount * .018}, ${1 + amount * .025})`;
        });
        frame = requestAnimationFrame(update);
      };
      frame = requestAnimationFrame(update);
    }
    return () => { cancelAnimationFrame(frame); nodes.forEach(node => { if (node) node.style.transform = ""; }); };
  }, [playing, reduced, activeHost, level, hostKey, hosts]);
  const selected = hosts.map(id => PODCAST_HOSTS.find(host => host.id === id));
  const status = stage === "script" ? "Merangkai naskah" : stage === "audio" ? "Menyiapkan suara" : playing ? "Sedang mengudara" : ready ? "Siap didengarkan" : "Studio siap";
  return <figure className={`ps-studio ${playing ? "is-playing" : ""} ${stage !== "idle" ? "is-preparing" : ""}`} aria-label={`Studio podcast dengan kursi, meja dan mikrofon untuk ${selected.map(host => host?.name).filter(Boolean).join(" dan ") || "dua host"}`}>
    <div className="ps-scene">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="ps-backdrop" src="/illustrations/podcast-studio-v1.webp" width={1600} height={900} alt="Studio podcast berwarna violet dengan dua kursi empuk, meja kayu dan dua mikrofon broadcast." fetchPriority="high" draggable={false} />
      <div className="ps-status" role="status"><i aria-hidden="true" />{status}</div>
      {[0, 1].map(index => <div key={index} className={`ps-seat ${index ? "is-right" : "is-left"} ${selected[index]?.id === activeHost && playing ? "is-speaking" : ""}`}>
        {selected[index] && <div key={selected[index].id} className="ps-character-entry"><div className="ps-character" ref={node => { actors.current[index] = node; }}><PodcastPortrait host={selected[index].id} /></div></div>}
      </div>)}
      <div className="ps-desk-front" aria-hidden="true" />
      <div className="ps-desk-plaque" aria-hidden="true"><span>eureka!</span><small>PODCAST STUDIO</small></div>
    </div>
    <figcaption className="ps-host-labels">{[0, 1].map(index => {
      const label = <><span className="ps-speaking-indicator" aria-hidden="true"><i /><i /><i /></span><span><strong>{selected[index]?.name ?? "Kursi kosong"}</strong><small>{onSeatPick ? `Kursi ${index ? "kanan" : "kiri"} · Ganti host` : selected[index] ? selected[index].id === activeHost && playing ? "Sedang berbicara" : selected[index].role : "Pilih host di bawah"}</small></span></>;
      return onSeatPick ? <button type="button" key={index} aria-pressed={editingSeat === index} aria-label={`Atur host kursi ${index ? "kanan" : "kiri"}`} onClick={() => onSeatPick(index)}>{label}</button> : <div key={index} className={selected[index]?.id === activeHost && playing ? "is-speaking" : ""}>{label}</div>;
    })}</figcaption>
  </figure>;
}
