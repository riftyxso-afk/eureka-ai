"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Minus, Plus, Maximize2, Search, ArrowUpRight } from "lucide-react";
import type { StudyMapNode } from "@/lib/study-mindmap";
import { layoutStudyMap } from "@/lib/study-map-layout";
import "./study-map.css";

export default function StudyMindmap({ nodes, busy = false, disabled = false, onExplore }: {
  nodes: StudyMapNode[]; busy?: boolean; disabled?: boolean; onExplore: (prompt: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const touched = useRef(false);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const layout = useMemo(() => layoutStudyMap(nodes, collapsed), [nodes, collapsed]);
  const root = nodes.find(node => node.parentId === null);
  const active = nodes.find(node => node.id === selected);
  const matches = query.trim() ? nodes.filter(node => `${node.label} ${node.detail}`.toLocaleLowerCase("id").includes(query.trim().toLocaleLowerCase("id"))) : [];

  useEffect(() => {
    const element = viewport.current;
    if (element && !touched.current) element.scrollLeft = Math.max(0, (layout.width * zoom - element.clientWidth) / 2);
  }, [layout.width, zoom]);

  function focusNode(node: StudyMapNode) {
    const next = new Set(collapsed);
    let parent = node.parentId;
    while (parent) { next.delete(parent); parent = nodes.find(item => item.id === parent)?.parentId ?? null; }
    setCollapsed(next); setSelected(node.id); touched.current = true;
    const position = layoutStudyMap(nodes, next).positions.find(item => item.node.id === node.id);
    requestAnimationFrame(() => {
      if (position && viewport.current) viewport.current.scrollTo({ left: Math.max(0, (position.x + 92) * zoom - viewport.current.clientWidth / 2), top: Math.max(0, position.y * zoom - 40), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    });
  }
  function fit() { if (viewport.current) { touched.current = false; setZoom(Math.max(.25, Math.min(1, viewport.current.clientWidth / layout.width))); viewport.current.scrollTop = 0; } }

  return <section className="study-map" data-streaming={busy} aria-label="Peta konsep interaktif" aria-busy={busy}>
    <header><strong>Peta konsep</strong><span role="status">{busy ? `Menyusun · ${nodes.length} konsep` : `${nodes.length} konsep`}</span></header>
    <label className="study-map-search"><Search size={16} aria-hidden="true" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari konsep…" aria-label="Cari konsep pada peta" /></label>
    {!!query.trim() && <div className="study-map-matches">{matches.length ? matches.map(node => <button type="button" key={node.id} onClick={() => focusNode(node)}>{node.label}</button>) : <span>Tidak ada konsep yang cocok.</span>}</div>}
    <div ref={viewport} className="study-map-viewport" tabIndex={0} aria-label="Kanvas peta konsep. Geser untuk melihat cabang lainnya." onPointerDown={event => {
      touched.current = true;
      if (event.pointerType !== "mouse" || event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
      drag.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
      event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerMove={event => {
      if (!drag.current) return;
      event.currentTarget.scrollLeft = drag.current.left - (event.clientX - drag.current.x);
      event.currentTarget.scrollTop = drag.current.top - (event.clientY - drag.current.y);
    }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onWheel={() => { touched.current = true; }}>
      {root ? <div className="study-map-size" style={{ width: layout.width * zoom, height: layout.height * zoom }}><div className="study-map-canvas" style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})` }}>
        <svg width={layout.width} height={layout.height} aria-hidden="true">{layout.edges.map(edge => <path key={edge.id} d={edge.path} />)}</svg>
        {layout.positions.map(({ node, x, y }) => <div key={node.id} className="study-map-node" data-root={node.parentId === null} data-selected={selected === node.id} data-match={matches.some(match => match.id === node.id)} style={{ transform: `translate(${x}px, ${y}px)` }}>
          <button type="button" onClick={() => setSelected(node.id)} aria-pressed={selected === node.id}><strong>{node.label}</strong></button>
          {nodes.some(child => child.parentId === node.id) && <button type="button" className="study-map-toggle" aria-label={`${collapsed.has(node.id) ? "Buka" : "Tutup"} cabang ${node.label}`} aria-expanded={!collapsed.has(node.id)} onClick={() => setCollapsed(previous => { const next = new Set(previous); if (next.has(node.id)) next.delete(node.id); else next.add(node.id); return next; })}><ChevronDown size={16} /></button>}
        </div>)}
      </div></div> : <p role="status">Menentukan konsep utama dari materi…</p>}
    </div>
    <div className="study-map-toolbar"><span>Geser untuk menjelajah</span><div>
      <button type="button" aria-label="Perkecil peta" disabled={zoom <= .25} onClick={() => setZoom(value => Math.max(.25, value - .15))}><Minus size={17} /></button>
      <output aria-label="Perbesaran peta">{Math.round(zoom * 100)}%</output>
      <button type="button" aria-label="Perbesar peta" disabled={zoom >= 1.6} onClick={() => setZoom(value => Math.min(1.6, value + .15))}><Plus size={17} /></button>
      <button type="button" aria-label="Tampilkan seluruh peta" onClick={fit}><Maximize2 size={16} /></button>
    </div></div>
    {active && <div className="study-map-detail"><strong>{active.label}</strong><p>{active.detail}</p><button type="button" disabled={disabled || busy} onClick={() => onExplore(`Jelaskan konsep “${active.label}” dalam peta “${root?.label}” dengan contoh, lalu bantu aku menguji pemahamanku.`)}>Bahas konsep ini<ArrowUpRight size={16} /></button></div>}
  </section>;
}
