"use client";

import { toast } from "@yusufceng1z/ding-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Grip, Pin, Plus, Search, Trash2, X } from "lucide-react";
import { getUserId } from "@/lib/identity";
import MomoCompanion from "@/components/asisten/MomoCompanion";
type Sticky = { id: string; text: string; color: number; pinned: boolean; x: number; y: number };
const COLORS = ["#fff0a8", "#e7dafa", "#cfeee4", "#ffdacc"];

export default function StickyBoard({ noteId, active }: { noteId: string; active: boolean }) {
  const [notes, setNotes] = useState<Sticky[]>([]);
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const drag = useRef<{ id: string; startX: number; startY: number; x: number; y: number } | null>(null);
  const key = `eureka:v2:stickies:${getUserId()}:${noteId}`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) { const parsed = JSON.parse(saved); if (Array.isArray(parsed)) setNotes(parsed.filter(n => typeof n?.id === "string" && typeof n.text === "string").slice(0, 50).map(n => ({ ...n, color: Number.isInteger(n.color) && n.color >= 0 && n.color < 4 ? n.color : 0, x: Number.isFinite(n.x) ? n.x : 24, y: Number.isFinite(n.y) ? n.y : 120 }))); }
      else { const legacy = localStorage.getItem(`eureka:v2:scratch:${getUserId()}:${noteId}`); if (legacy) setNotes([{ id: crypto.randomUUID(), text: legacy, color: 0, pinned: false, x: 24, y: 120 }]); }
      setLoaded(true);
    } catch { setError("Penyimpanan perangkat tidak tersedia. Catatan belum tersimpan."); }
  }, [key, noteId]);
  useEffect(() => { if (!loaded) return; const timer = setTimeout(() => { try { localStorage.setItem(key, JSON.stringify(notes)); } catch { setError("Perubahan belum tersimpan. Penyimpanan perangkat penuh atau tidak tersedia."); } }, 250); return () => clearTimeout(timer); }, [notes, key, loaded]);
  useEffect(() => {
    if (!loaded) return;
    const flush = () => { try { localStorage.setItem(key, JSON.stringify(notes)); } catch {} };
    window.addEventListener("pagehide", flush); return () => { flush(); window.removeEventListener("pagehide", flush); };
  }, [notes, key, loaded]);
  function update(id: string, value: Partial<Sticky>) { setNotes(all => all.map(n => n.id === id ? { ...n, ...value } : n)); }
  function pin(note: Sticky) { update(note.id, { pinned: !note.pinned, ...(!note.pinned ? { x: Math.max(8, window.innerWidth - 290), y: Math.max(160, window.innerHeight - 320) } : {}) }); }
  function add() { if (notes.length >= 50) { setError("Maksimal 50 kertas untuk catatan ini."); return; } setNotes(all => [...all, { id: crypto.randomUUID(), text: "", color: all.length % 4, pinned: false, x: 24 + all.length % 3 * 35, y: 120 + all.length % 3 * 35 }]); }
  function paper(note: Sticky, floating = false) {
    return <article key={note.id} className={`rm-sticky ${floating ? "is-floating" : ""}`} style={{ "--paper": COLORS[note.color], "--tilt": `${note.color % 2 ? 1 : -1}deg`, ...(floating ? { left: Math.min(note.x, Math.max(8, window.innerWidth - 280)), top: Math.min(note.y, Math.max(8, window.innerHeight - 280)) } : {}) } as CSSProperties}>
      <div className="rm-sticky-tape" aria-hidden="true" /><div className="rm-sticky-tools"><button aria-label={`${floating ? "Geser" : "Tempelkan"} kertas`} title={floating ? "Seret untuk memindahkan. Tombol panah juga bisa digunakan." : "Tempel di layar untuk menggeser"} onClick={() => { if (!floating) pin(note); }} onKeyDown={e => { if (floating && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) { e.preventDefault(); update(note.id, { x: Math.max(8, Math.min(window.innerWidth - 280, note.x + (e.key === "ArrowLeft" ? -20 : e.key === "ArrowRight" ? 20 : 0))), y: Math.max(8, Math.min(window.innerHeight - 280, note.y + (e.key === "ArrowUp" ? -20 : e.key === "ArrowDown" ? 20 : 0))) }); } }} onPointerDown={e => { if (!floating) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { id: note.id, startX: e.clientX, startY: e.clientY, x: note.x, y: note.y }; }} onPointerMove={e => { const d = drag.current; if (d?.id === note.id) update(note.id, { x: Math.max(8, Math.min(window.innerWidth - 280, d.x + e.clientX - d.startX)), y: Math.max(8, Math.min(window.innerHeight - 280, d.y + e.clientY - d.startY)) }); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}><Grip size={15} /></button><span>{floating ? "Tertempel" : "Kertas catatan"}</span><button aria-label={floating ? "Kembalikan ke papan" : "Tempel di layar"} onClick={() => pin(note)}>{floating ? <X size={15} /> : <Pin size={15} />}</button><button aria-label="Hapus kertas" title="Hapus kertas" onClick={() => { setNotes(all => all.filter(n => n.id !== note.id)); toast.info("Kertas dihapus.", { duration: 7000, action: { label: "Urungkan", onClick: () => setNotes(all => all.some(n => n.id === note.id) ? all : [...all, note]) } }); }}><Trash2 size={14} /></button></div>
      <textarea aria-label="Isi kertas tempel" maxLength={2500} value={note.text} placeholder="Tulis hal yang ingin kamu ingat…" onChange={e => update(note.id, { text: e.target.value })} />
      <div className="rm-sticky-colors" aria-label="Warna kertas">{COLORS.map((color, index) => <button key={color} style={{ background: color }} aria-label={`Warna kertas ${["kuning", "violet", "hijau", "persik"][index]}`} aria-pressed={note.color === index} onClick={() => update(note.id, { color: index })} />)}<small>{note.text.length}/2500</small></div>
    </article>;
  }
  const visible = notes.filter(n => !n.pinned && n.text.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <>{active && <section className="rm-sticky-section"><div className="rm-feature-heading"><div><h1>Catatan tempel</h1><p>Kertas kecil untuk ide besar. Tempel di layar sambil belajar.</p></div><button className="dv2-button" onClick={add}><Plus size={16} />Kertas baru</button></div><div className="rm-sticky-filter"><label><Search size={16} /><input aria-label="Cari catatan tempel" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari catatan tempel…" /></label><small>{notes.length} kertas · Disimpan di perangkat ini</small></div>{error && <p className="rm-error" role="alert">{error}</p>}<div className="rm-sticky-board">{visible.map(n => paper(n))}{!visible.length && <div className="rm-sticky-empty"><div className="sr-momo"><MomoCompanion mode="fast" /></div><h2>{query ? "Kertas tidak ditemukan" : notes.length ? "Kertasmu sedang tertempel" : "Ide pertamamu dimulai di sini"}</h2><p>{query ? "Coba kata pencarian lainnya." : notes.length ? "Kembalikan kertas ke papan dengan tombol tutup di pojoknya." : "Tulis pertanyaan, rangkuman singkat, atau hal yang ingin kamu ingat."}</p>{!query && !notes.length && <button onClick={add}>Buat kertas pertama <Plus size={15} /></button>}</div>}</div></section>}{loaded && notes.filter(n => n.pinned).map(n => paper(n, true))}</>;
}
