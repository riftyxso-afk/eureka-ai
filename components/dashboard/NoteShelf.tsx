"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen } from "lucide-react";
import type { Note } from "@/lib/types";

const colors = ["#7540ba", "#477f91", "#d88a5b", "#577d66", "#b8667e", "#a87a36"];
function colorFor(subject: string) {
  let hash = 0;
  for (const char of subject || "catatan") hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return colors[hash % colors.length];
}

export default function NoteShelf({ notes, locale }: { notes: Note[]; locale: string }) {
  const [selectedId, setSelectedId] = useState(notes[0]?.id ?? "");
  const drag = useRef<{ x: number; dragged: boolean } | null>(null);
  const index = Math.max(0, notes.findIndex((note) => note.id === selectedId));
  const selected = notes[index];
  useEffect(() => {
    if (!notes.some((note) => note.id === selectedId)) setSelectedId(notes[0]?.id ?? "");
  }, [notes, selectedId]);
  if (!selected) return null;
  const move = (amount: number) => {
    const next = Math.max(0, Math.min(notes.length - 1, index + amount));
    setSelectedId(notes[next].id);
  };
  const handleKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      move(event.key === "ArrowLeft" ? -1 : 1);
    }
  };
  const pointerDown = (event: PointerEvent<HTMLElement>) => { drag.current = { x: event.clientX, dragged: false }; };
  const pointerUp = (event: PointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    const delta = event.clientX - drag.current.x;
    if (Math.abs(delta) > 35) { drag.current.dragged = true; move(delta > 0 ? -1 : 1); }
  };

  return <section className="note-shelf" aria-label={locale === "en" ? "Bookshelf" : "Rak buku catatan"} onKeyDown={handleKey}>
    <div className="note-shelf-top"><div><span>{locale === "en" ? "YOUR BOOKSHELF" : "RAK BELAJARMU"}</span><h2>{locale === "en" ? "A shelf full of ideas." : "Setiap catatan, satu cerita."}</h2></div><span className="note-shelf-count">{String(index + 1).padStart(2, "0")} / {String(notes.length).padStart(2, "0")}</span></div>
    <div className="note-shelf-stage" onPointerDown={pointerDown} onPointerUp={pointerUp} onPointerCancel={() => { drag.current = null; }}>
      <div className="note-shelf-books" style={{ "--active-index": index } as React.CSSProperties}>
        {notes.map((note, i) => <button key={note.id} type="button" className={`note-shelf-book ${i === index ? "is-active" : ""}`} style={{ "--book-color": colorFor(note.subject), "--position": i - index } as React.CSSProperties} aria-label={`${note.title}${i === index ? (locale === "en" ? ", selected" : ", dipilih") : ""}`} aria-pressed={i === index} onClick={() => { if (drag.current?.dragged) { drag.current = null; return; } setSelectedId(note.id); }}>
          <span className="note-book-spine"><span className="note-book-mark">E</span><span className="note-spine-title">{note.title}</span><span className="note-spine-bottom">EUREKA</span></span>
          <span className="note-book-cover"><span className="note-cover-brand">EUREKA · CATATAN</span><span className="note-cover-subject">{note.subject || (locale === "en" ? "Notes" : "Catatan")}</span><span className="note-cover-title">{note.title}</span><span className="note-cover-illustration"><BookOpen size={44} strokeWidth={1.3} /></span><span className="note-cover-bottom">{locale === "en" ? "MADE FOR LEARNING" : "TEMAN BELAJARMU"}</span></span>
        </button>)}
      </div>
    </div>
    <div className="note-shelf-footer"><div className="note-shelf-caption" aria-live="polite"><span>{selected.subject || (locale === "en" ? "Notes" : "Catatan")}</span><h3>{selected.title}</h3><p>{new Date(selected.createdAt).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", { day: "numeric", month: "long", year: "numeric" })}</p></div><div className="note-shelf-controls"><button type="button" onClick={() => move(-1)} disabled={index === 0} aria-label={locale === "en" ? "Previous book" : "Buku sebelumnya"}><ArrowLeft size={19} /></button><button type="button" onClick={() => move(1)} disabled={index === notes.length - 1} aria-label={locale === "en" ? "Next book" : "Buku berikutnya"}><ArrowRight size={19} /></button><Link href={`/dashboard/note/${selected.id}`} className="note-shelf-open">{locale === "en" ? "Open note" : "Buka catatan"}<ArrowUpRight size={16} /></Link></div></div>
  </section>;
}
