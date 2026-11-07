"use client";
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import type { NoteChapter } from "@/lib/types";

export default function ChapterPath({ chapters, read, onOpen }: { chapters: NoteChapter[]; read: number[]; onOpen: (id: number) => void }) {
  const scene = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<{ width: number; height: number; paths: string[] }>({ width: 1, height: 1, paths: [] });
  useEffect(() => {
    const root = scene.current; if (!root) return;
    const measure = () => {
      const bounds = root.getBoundingClientRect();
      const points = [...root.querySelectorAll<HTMLButtonElement>('.sr-node')].map(node => { const rect = node.getBoundingClientRect(); return { x: rect.x - bounds.x + rect.width / 2, y: rect.y - bounds.y + rect.height / 2 }; });
      const paths = points.slice(1).map((to, i) => { const from = points[i]; const bend = (to.y - from.y) * .62; const mobile = bounds.width < 600; const bulge = mobile ? (i % 2 ? -13 : 19) : 0; return `M ${from.x} ${from.y} C ${from.x + bulge} ${from.y + bend}, ${to.x + bulge} ${to.y - bend}, ${to.x} ${to.y}`; });
      setGeometry({ width: bounds.width, height: bounds.height, paths });
    };
    const observer = new ResizeObserver(measure); observer.observe(root); measure();
    return () => observer.disconnect();
  }, [chapters]);
  return <div className="sr-path-scene" ref={scene}>
    <svg className="sr-path-curve" width="100%" height="100%" viewBox={`0 0 ${geometry.width} ${geometry.height}`} aria-hidden="true">{geometry.paths.map((d, i) => <path key={chapters[i].id} d={d} className={read.includes(chapters[i].id) ? "is-complete" : ""} />)}</svg>
    <ol className="sr-path">{chapters.map((chapter, index) => <li key={chapter.id} className={index % 2 ? "is-left" : "is-right"}><button className={`sr-node ${read.includes(chapter.id) ? "is-done" : ""}`} onClick={() => onOpen(chapter.id)} aria-label={`Buka bab ${index + 1}: ${chapter.title}`}>{read.includes(chapter.id) ? <Check size={20} /> : index + 1}</button><div className="sr-chapter-card"><div><p className="sr-chapter-label">BAB {String(index + 1).padStart(2, "0")}{read.includes(chapter.id) ? " · SELESAI" : ""}</p><h3>{chapter.title}</h3></div><button className="dv2-button" onClick={() => onOpen(chapter.id)}>{read.includes(chapter.id) ? "Ulangi" : "Mulai"}</button></div></li>)}</ol>
  </div>;
}
