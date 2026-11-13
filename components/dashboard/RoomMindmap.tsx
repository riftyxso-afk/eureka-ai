"use client";

import {usePinchZoom} from "@/lib/usePinchZoom";
import { toast } from "@yusufceng1z/ding-react";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowUpRight, ChevronDown, ChevronRight, Expand, Minus, Plus, Search, Sparkles, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import type { Note } from "@/lib/types";
import { mindmapBranch, type MindmapBranch, type MindmapConcept } from "@/lib/mindmapStream";
import { readStudyEvents } from "@/lib/studyRoom";
import StudyDreaming from "./StudyDreaming";
const DocumentEditor = dynamic(() => import("./DocumentEditor"), { ssr: false });
type Concept = MindmapConcept;
type Branch = MindmapBranch;
type Node = { key: string; label: string; x: number; y: number; width: number; chapter?: number; detail?: string; root?: boolean; leaf?: boolean };

export default function RoomMindmap({ note, onOpen, onSaved, onDirtyChange }: { note: Note; onOpen: (id: number | null) => void; onSaved: (id: number | null, title: string, content: string, warning?: string) => void; onDirtyChange: (value: boolean) => void }) {
  const [selected, setSelected] = useState<number | null>(note.chapters?.[0]?.id ?? null);
  const [detail, setDetail] = useState<Concept | null>(null);
  const [dirty, setDirty] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [collapsed, setCollapsed] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [mobilePane, setMobilePane] = useState<"map" | "notes">("map");
  const [progress, setProgress] = useState({ completed: 0, total: 0, characters: 0 });
  const locked = useRef(false);
  const [view, setView] = useState({ x: 25, y: 30, scale: .75 });
  const canvas = useRef<HTMLDivElement>(null);
  const pinch=useCallback((scale:number)=>setView(v=>({...v,scale})),[]);
  usePinchZoom(canvas,view.scale,pinch);
  const request = useRef<AbortController | null>(null);
  const drag = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const storage = `eureka:v2:mindmap:${getUserId()}:${note.id}`;
  const fingerprint = JSON.stringify(note.chapters?.map(c => [c.id, c.title, c.content]));
  useEffect(() => {
    try { const stored = JSON.parse(localStorage.getItem(storage) || "null"); if (stored?.fingerprint === fingerprint && Array.isArray(stored.branches)) setBranches(stored.branches.map((value: unknown) => mindmapBranch(value, (note.chapters ?? []).map(chapter => chapter.id))).filter((value: Branch | null): value is Branch => !!value)); else setBranches([]); } catch { /* The original chapter graph remains available. */ }
    return () => request.current?.abort();
  }, [storage, fingerprint, note.chapters]);
  const graph = useMemo(() => {
    const nodes: Node[] = [];
    const edges: { from: Node; to: Node }[] = [];
    let offset = 30;
    const chapters = note.chapters ?? [];
    for (const chapter of chapters) {
      const headings = [...(chapter.content ?? "").matchAll(/^#{1,4}\s+(.+)$/gm)].map(m => ({ label: m[1].replace(/[*_`]/g, "").slice(0, 60), detail: chapter.content.slice((m.index ?? 0) + m[0].length).split(/^#{1,4}\s/m)[0].trim().replace(/[*#`]/g, "").slice(0, 420) })).filter(c => c.label !== chapter.title).slice(0, 3);
      const concepts = branches.find(b => b.id === chapter.id)?.concepts ?? (busy ? [] : headings);
      const leaves = collapsed.includes(chapter.id) ? [] : concepts;
      const height = Math.max(110, (busy ? 3 : leaves.length) * 90);
      const parent: Node = { key: `chapter-${chapter.id}`, label: chapter.title, chapter: chapter.id, x: 325, y: offset + height / 2 - 35, width: 215 };
      nodes.push(parent);
      leaves.forEach((concept, index) => {
        const leaf: Node = { key: `${chapter.id}-${index}`, label: concept.label, detail: concept.detail, chapter: chapter.id, leaf: true, x: 615, y: offset + index * 90, width: 205 };
        nodes.push(leaf); edges.push({ from: parent, to: leaf });
      });
      offset += height + 25;
    }
    const root: Node = { key: "root", label: note.title, root: true, x: 30, y: offset / 2 - 35, width: 220 };
    nodes.unshift(root);
    nodes.filter(n => n.chapter !== undefined && !n.leaf).forEach(n => edges.push({ from: root, to: n }));
    return { nodes, edges, width: busy || nodes.some(n => n.leaf) ? 855 : 580, height: Math.max(offset + 20, 300) };
  }, [branches, collapsed, note, busy]);
  const fit = useCallback(() => {
    const bounds = canvas.current?.getBoundingClientRect(); if (!bounds) return;
    const scale = Math.max(.2, Math.min(.95, (bounds.width - 44) / graph.width, (bounds.height - 70) / graph.height));
    setView({ scale, x: (bounds.width - graph.width * scale) / 2, y: (bounds.height - graph.height * scale) / 2 });
  }, [graph.width, graph.height]);
  useEffect(() => { const observer = new ResizeObserver(fit); if (canvas.current) observer.observe(canvas.current); fit(); return () => observer.disconnect(); }, [fit]);
  function select(node: Node) {
    if (dirty) { toast.warning("Simpan atau batalkan perubahan editor sebelum memilih cabang lain."); return; }
    setSelected(node.chapter ?? null); setDetail(node.leaf ? { label: node.label, detail: node.detail ?? "" } : null);
  }
  function zoom(factor: number) {
    const rect = canvas.current?.getBoundingClientRect(); if (!rect) return;
    setView(v => { const scale = Math.max(.2, Math.min(1.8, v.scale * factor)); return { scale, x: rect.width / 2 - (rect.width / 2 - v.x) * scale / v.scale, y: rect.height / 2 - (rect.height / 2 - v.y) * scale / v.scale }; });
  }
  async function develop() {
    if (locked.current) return;
    if (dirty) { toast.warning("Simpan atau batalkan perubahan catatan sebelum mengembangkan mindmap."); return; }
    locked.current = true; const previous = branches; setBranches([]); setCollapsed([]); setDetail(null); setBusy(true);
    setProgress({ completed: 0, total: Math.min(20, note.chapters?.length ?? 0), characters: 0 });
    const controller = new AbortController(); request.current = controller;
    try {
      const response = await apiFetch(`/api/notes/${note.id}/mindmap`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stream: true }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(160000)]) });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || "Mindmap belum dapat dikembangkan."); }
      let complete = false; let final: Branch[] = []; const ids = (note.chapters ?? []).map(c => c.id); const received = new Map<number, Branch>();
      await readStudyEvents(response, event => {
        if (event.type === "error") throw new Error(typeof event.message === "string" ? event.message : "Pengembangan mindmap terputus.");
        if (event.type === "chapter") {
          const branch = mindmapBranch(event.chapter, ids);
          if (branch) { received.set(branch.id, branch); setBranches([...received.values()]); setProgress(p => ({ ...p, completed: received.size })); }
        }
        if (event.type === "progress" && typeof event.characters === "number") setProgress(p => ({ ...p, characters: event.characters as number }));
        if (event.type === "done" && Array.isArray(event.chapters)) {
          final = event.chapters.map(v => mindmapBranch(v, ids)).filter((v): v is Branch => !!v); complete = final.length > 0;
          if (typeof event.characters === "number") setProgress(p => ({ ...p, characters: event.characters as number }));
        }
      });
      if (!complete) throw new Error("Proses belum selesai. Peta sebelumnya dipulihkan; silakan coba lagi.");
      setBranches(final);
      try { localStorage.setItem(storage, JSON.stringify({ fingerprint, branches: final })); } catch { toast.warning("Peta siap digunakan. Penyimpanan perangkat tidak tersedia."); }
      if (final.length < Math.min(20, note.chapters?.length ?? 0)) toast.warning(`${final.length} bab berhasil dikembangkan. Bab lainnya tetap menggunakan struktur catatan.`);
    } catch (failure) { setBranches(previous); if (!controller.signal.aborted) toast.error(failure instanceof Error && failure.name === "TimeoutError" ? "AI membutuhkan waktu lebih lama. Peta sebelumnya tetap tersedia." : failure instanceof Error ? failure.message : "Mindmap belum dapat dikembangkan."); }
    finally { locked.current = false; setBusy(false); }
  }
  const chapter = note.chapters?.find(c => c.id === selected);
  const selectedConcepts = branches.find(branch => branch.id === selected)?.concepts ?? [];
  return <section className="rm-mindmap">
    <div className="rm-feature-heading"><div><h1>Mindmap <span className="rm-beta">Beta</span></h1><p>Telusuri konsep, lalu pelajari dan edit bab di sampingnya.</p></div><div className="rm-mindmap-actions">{busy && <button className="sp-text-button" onClick={() => request.current?.abort()}>Hentikan</button>}<button className="dv2-button" disabled={busy || !note.chapters?.length} onClick={() => void develop()}><Sparkles size={15} />{busy ? "Menyusun konsep…" : "Kembangkan dengan AI"}</button></div></div>
    <div className="rm-map-pane-switch" role="group" aria-label="Tampilan mindmap"><button aria-pressed={mobilePane === "map"} onClick={() => setMobilePane("map")}>Mindmap</button><button aria-pressed={mobilePane === "notes"} onClick={() => setMobilePane("notes")}>Isi bab {busy ? "· Menyusun…" : ""}</button></div>
    <div className={`rm-map-layout show-${mobilePane} ${busy ? "is-generating" : ""}`}>
      <div className="rm-map-side"><label className="rm-map-search"><Search size={15} /><input disabled={busy} aria-label="Cari konsep" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari konsep atau bab…" /></label>
        <div onTouchStart={e=>{if(e.touches.length===2)drag.current=null;}} className="rm-map-canvas" ref={canvas} aria-label="Kanvas mindmap, seret latar untuk menggeser" onPointerDown={e => { if ((e.target as Element).closest("button,input")) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, originX: view.x, originY: view.y }; }} onPointerMove={e => { const d = drag.current; if (d) setView(v => ({ ...v, x: d.originX + e.clientX - d.x, y: d.originY + e.clientY - d.y })); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
          <div className="rm-map-viewport" style={{ width: graph.width, height: graph.height, transform: `translate(${view.x}px,${view.y}px) scale(${view.scale})` }}>
            <svg width={graph.width} height={graph.height} aria-hidden="true">{graph.edges.map(({ from, to }) => <path key={`${from.key}:${to.key}`} d={`M ${from.x + from.width} ${from.y + 35} C ${from.x + from.width + 44} ${from.y + 35}, ${to.x - 44} ${to.y + 35}, ${to.x} ${to.y + 35}`} className={to.chapter === selected ? "is-selected" : ""} />)}</svg>
            {graph.nodes.map(node => <div key={node.key} className={`rm-map-node ${busy && node.leaf ? "is-revealing" : ""} ${busy && !node.root && !branches.some(branch => branch.id === node.chapter) ? "is-pending" : ""} ${node.root ? "is-root" : ""} ${node.leaf ? "is-leaf" : ""} ${node.chapter === selected && !node.leaf ? "is-selected" : ""} ${query && node.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()) ? "is-match" : ""}`} style={{ left: node.x, top: node.y, width: node.width }}><button aria-pressed={node.root ? selected === null : node.chapter === selected && (!node.leaf || detail?.label === node.label)} onClick={() => select(node)}>{node.root && <small>CATATANMU</small>}{node.label}</button>{!node.root && !node.leaf && <button disabled={busy} className="rm-collapse" aria-label={`${collapsed.includes(node.chapter!) ? "Perluas" : "Ciutkan"} ${node.label}`} aria-expanded={!collapsed.includes(node.chapter!)} onClick={() => setCollapsed(c => c.includes(node.chapter!) ? c.filter(id => id !== node.chapter) : [...c, node.chapter!])}>{collapsed.includes(node.chapter!) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</button>}</div>)}
          </div>
          {busy && <div className={`rm-map-dream-overlay ${branches.length ? "has-content" : ""}`}><StudyDreaming compact={branches.length > 0} title={branches.length ? "Konsep mulai terhubung" : "Momo sedang membayangkan petamu"} detail={branches.length ? "Cabang baru tampil saat diterima dari AI." : "Membaca bab dan merangkai hubungan antarkonsep…"} completed={progress.completed} total={progress.total} characters={progress.characters} /></div>}
          <div className="rm-map-controls"><button aria-label="Perbesar mindmap" onClick={() => zoom(1.2)}><Plus size={18} /></button><span>{Math.round(view.scale * 100)}%</span><button aria-label="Perkecil mindmap" onClick={() => zoom(1 / 1.2)}><Minus size={18} /></button><button aria-label="Sesuaikan mindmap ke layar" onClick={fit}><Expand size={17} /></button></div>
          {detail && <aside className="rm-concept-preview"><button aria-label="Tutup pratinjau konsep" onClick={() => setDetail(null)}><X size={15} /></button><strong>{detail.label}</strong><p>{detail.detail || "Buka bab terkait untuk mempelajari konsep ini."}</p></aside>}
          {query && !graph.nodes.some(n => n.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())) && <p className="rm-map-empty">Konsep tidak ditemukan. Coba kata lain.</p>}
        </div><p className="rm-map-hint">Seret kanvas untuk menggeser · pilih cabang untuk membaca</p>
      </div>
      <div className="rm-map-reader" aria-busy={busy}><div className="rm-reader-heading"><strong>{chapter?.title ?? "Ringkasan catatan"}</strong><button disabled={busy} onClick={() => { if (dirty) toast.warning("Simpan perubahan sebelum membuka editor penuh."); else onOpen(selected); }}>Buka penuh <ArrowUpRight size={15} /></button></div>
        {busy ? <div className="rm-dream-document"><StudyDreaming paper compact={selectedConcepts.length > 0} title="Menyiapkan hubungan dari isi bab" detail="Catatanmu dipakai sebagai dasar untuk menyusun peta konsep." />{selectedConcepts.length > 0 && <div className="rm-live-concepts"><p className="sp-eyebrow">PRATINJAU KONSEP DARI BAB INI</p>{selectedConcepts.map(concept => <article key={concept.label}><h3>{concept.label}</h3><p>{concept.detail}</p></article>)}</div>}</div> : <DocumentEditor key={chapter?.id ?? "summary"} noteId={note.id} title={note.title} content={chapter?.content ?? note.summary ?? ""} chapterId={chapter?.id} label={chapter?.title ?? "Ringkasan"} onDirtyChange={v => { setDirty(v); onDirtyChange(v); }} onSaved={(title, content, warning) => onSaved(selected, title, content, warning)} />}
      </div>
    </div>
  </section>;
}
