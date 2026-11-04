"use client";

import { useEffect, useRef, useState } from "react";
import { PageFlip } from "page-flip";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import MarkdownView from "@/components/asisten/MarkdownView";
import type { NoteChapter } from "@/lib/types";

export default function NoteFlipBook({ title, summary, chapters, color, locale }: {
  title: string; summary?: string; chapters: NoteChapter[]; color: string; locale: string;
}) {
  const templates = useRef<HTMLDivElement>(null);
  const mount = useRef<HTMLDivElement>(null);
  const engine = useRef<PageFlip | null>(null);
  const [page, setPage] = useState(0);
  const [ready, setReady] = useState(false);
  const count = Math.max(chapters.length, 1) + 3;
  useEffect(() => {
    if (!mount.current || !templates.current) return;
    const host = document.createElement("div");
    mount.current.append(host);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const height = Math.min(560, Math.max(300, window.innerHeight - 200));
    const flip = new PageFlip(host, {
      width: height * .75, height, size: "stretch", minWidth: 220, maxWidth: height * .75,
      minHeight: 290, maxHeight: height, showCover: true, drawShadow: true,
      maxShadowOpacity: .28, flippingTime: reduced ? 1 : 700,
      mobileScrollSupport: false, disableFlipByClick: true, useMouseEvents: !reduced,
    });
    engine.current = flip;
    const pages = Array.from(templates.current.children).map(node => node.cloneNode(true) as HTMLElement);
    pages.forEach(node => host.append(node));
    flip.on("flip", event => setPage(Number(event.data)));
    flip.loadFromHTML(pages);
    setReady(true);
    const jump = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-chapter-page]");
      if (target) flip.flip(Number(target.dataset.chapterPage), "bottom");
    };
    host.addEventListener("click", jump);
    const timer = window.setTimeout(() => flip.flipNext("bottom"), reduced ? 0 : 400);
    return () => {
      window.clearTimeout(timer);
      host.removeEventListener("click", jump);
      engine.current = null;
      flip.destroy();
      host.remove();
    };
  }, [title, summary, chapters]);

  return <div className="note-flip-reader" style={{ "--reader-color": color } as React.CSSProperties}>
    <div hidden ref={templates}>
      <div className="note-flip-paper note-flip-cover" data-density="hard"><div><span>EUREKA · CATATAN</span><BookOpen size={58} /><h2>{title}</h2><small>{locale === "en" ? "YOUR LEARNING COMPANION" : "TEMAN BELAJARMU"}</small></div></div>
      <div className="note-flip-paper"><div className="note-flip-page-inner"><small>DAFTAR ISI</small><h2>{title}</h2><nav aria-label="Daftar bab">{chapters.map((chapter, i) => <button key={chapter.id} data-chapter-page={i + 2}><span>{String(i + 1).padStart(2, "0")}</span>{chapter.title}<ArrowRight size={15} /></button>)}</nav><footer>EUREKA</footer></div></div>
      {chapters.length ? chapters.map((chapter, i) => <div className="note-flip-paper" key={chapter.id}><div className="note-flip-page-inner"><small>BAB {i + 1}</small><h2>{chapter.title}</h2><div className="note-flip-copy"><MarkdownView content={chapter.content || summary || "Isi bab belum tersedia."} /></div><footer>{i + 1}</footer></div></div>) : <div className="note-flip-paper"><div className="note-flip-page-inner"><h2>{title}</h2><div className="note-flip-copy"><MarkdownView content={summary || "Catatan ini belum memiliki isi."} /></div></div></div>}
      <div className="note-flip-paper note-flip-cover" data-density="hard"><div><BookOpen size={48} /><h2>Sampai di halaman berikutnya.</h2><small>EUREKA</small></div></div>
    </div>
    <div ref={mount} className="note-flip-mount" />
    <div className="note-flip-controls"><button aria-label="Halaman sebelumnya" disabled={!ready || page === 0} onClick={() => engine.current?.flipPrev("bottom")}><ArrowLeft size={18} /></button><span aria-live="polite">{page === 0 ? "Sampul" : `Halaman ${page} / ${Math.max(count - 2, 1)}`}</span><button aria-label="Halaman berikutnya" disabled={!ready || page >= Math.max(count - 2, 2)} onClick={() => engine.current?.flipNext("bottom")}><ArrowRight size={18} /></button></div>
  </div>;
}
