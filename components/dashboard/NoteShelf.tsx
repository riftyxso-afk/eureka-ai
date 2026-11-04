"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, Atom, BookOpen, Braces, Calculator, FlaskConical, Globe2, Languages, Leaf, Microscope, X } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import MarkdownView from "@/components/asisten/MarkdownView";
import NoteFlipBook from "./NoteFlipBook";
import type { Note, NoteChapter } from "@/lib/types";

const colors = ["#7540ba", "#477f91", "#d88a5b", "#577d66", "#b8667e", "#a87a36"];
const themes = [
  { match: /fisika|physics|mekanika|gravitasi/i, color: "#334f91", label: "Fisika", icon: Atom, motif: "E = mc²" },
  { match: /matematika|mathematics|math|aljabar|kalkulus/i, color: "#7550a4", label: "Matematika", icon: Calculator, motif: "∑  π  ∞" },
  { match: /\btik\b|informatika|komputer|computer|coding|pemrograman/i, color: "#286d7a", label: "TIK", icon: Braces, motif: "< / >" },
  { match: /biologi|biology|fotosintesis/i, color: "#477962", label: "Biologi", icon: Leaf, motif: "BIO" },
  { match: /kimia|chemistry/i, color: "#a95b6f", label: "Kimia", icon: FlaskConical, motif: "H₂O" },
  { match: /geografi|geography|sejarah|history/i, color: "#b07848", label: "Ilmu sosial", icon: Globe2, motif: "ATLAS" },
  { match: /bahasa|language|english|inggris/i, color: "#9a5e80", label: "Bahasa", icon: Languages, motif: "Aa" },
  { match: /\bipa\b|sains|science/i, color: "#397c87", label: "Sains", icon: Microscope, motif: "LAB" },
];
function themeFor(note: Note) {
  const subject = note.subject?.trim() ?? "";
  const generic = /^(dokumen|youtube|web|video|audio|catatan)$/i.test(subject);
  return themes.find((theme) => theme.match.test(subject)) ??
    (generic || !subject ? themes.find((theme) => theme.match.test(note.title)) : undefined);
}
function colorFor(subject: string) {
  let hash = 0;
  for (const char of subject || "catatan") hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return colors[hash % colors.length];
}

export default function NoteShelf({ notes, locale }: { notes: Note[]; locale: string }) {
  const [selectedId, setSelectedId] = useState(notes[0]?.id ?? "");
  const [details, setDetails] = useState<{ id: string; chapters: NoteChapter[]; summary?: string } | null>(null);
  const [detailError, setDetailError] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [opened, setOpened] = useState(false);
  const [chapterId, setChapterId] = useState<number | null>(null);
  const drag = useRef<{ x: number; dragged: boolean } | null>(null);
  const index = Math.max(0, notes.findIndex((note) => note.id === selectedId));
  const selected = notes[index];
  useEffect(() => {
    if (!notes.some((note) => note.id === selectedId)) setSelectedId(notes[0]?.id ?? "");
  }, [notes, selectedId]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (opened && !dialog.open) dialog.showModal();
    else if (!opened && dialog.open) dialog.close();
  }, [opened]);
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    setDetails(null);
    setDetailError(false);
    setDetailLoading(true);
    void apiFetch(`/api/notes/${encodeURIComponent(selectedId)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("note details unavailable");
        const data = await response.json() as { note?: Note; chapters?: NoteChapter[] };
        if (!controller.signal.aborted) setDetails({ id: selectedId, chapters: Array.isArray(data.chapters) ? data.chapters : data.note?.chapters ?? [], summary: data.note?.summary });
      })
      .catch(() => { if (!controller.signal.aborted) setDetailError(true); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [selectedId, retry]);
  if (!selected) return null;
  const move = (amount: number) => {
    const next = Math.max(0, Math.min(notes.length - 1, index + amount));
    setSelectedId(notes[next].id);
  };
  const openBook = (id: string) => { setSelectedId(id); setChapterId(null); setOpened(true); };
  const handleShelfKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); }
  };
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => { drag.current = { x: event.clientX, dragged: false }; };
  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const delta = event.clientX - drag.current.x;
    if (Math.abs(delta) > 35) { drag.current.dragged = true; move(delta > 0 ? -1 : 1); }
  };
  const selectedDetails = details?.id === selected.id ? details : null;
  const chapters = selectedDetails?.chapters ?? [];
  const activeChapter = chapters.find((chapter) => chapter.id === chapterId);

  return <section className="note-shelf" aria-label={locale === "en" ? "Bookshelf" : "Rak buku catatan"}>
    <div className="note-shelf-top"><div><span>{locale === "en" ? "YOUR BOOKSHELF" : "RAK BELAJARMU"}</span><h2>{locale === "en" ? "A shelf full of ideas." : "Setiap catatan, satu cerita."}</h2></div><span className="note-shelf-count">{String(index + 1).padStart(2, "0")} / {String(notes.length).padStart(2, "0")}</span></div>
    <div className="note-shelf-stage" onKeyDown={handleShelfKey} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerCancel={() => { drag.current = null; }}>
      <div className="note-shelf-books">
        {notes.map((note, i) => { const theme = themeFor(note); const Icon = theme?.icon ?? BookOpen; return <button key={note.id} type="button" className={`note-shelf-book ${i === index ? "is-active" : ""}`} style={{ "--book-color": theme?.color ?? colorFor(note.subject), "--position": i - index } as React.CSSProperties} aria-label={`${note.title}${i === index ? (locale === "en" ? ", selected, open book" : ", dipilih, buka buku") : (locale === "en" ? ", select book" : ", pilih buku")}`} aria-pressed={i === index} onClick={() => { if (drag.current?.dragged) { drag.current = null; return; } if (i === index) openBook(note.id); else setSelectedId(note.id); }}>
          <span className="note-book-spine"><span className="note-book-mark">E</span><span className="note-spine-title">{note.title}</span><span className="note-spine-bottom">EUREKA</span></span>
          <span className="note-book-cover"><span className="note-cover-brand">EUREKA · CATATAN</span><span className="note-cover-subject">{theme?.label ?? (note.subject || (locale === "en" ? "Notes" : "Catatan"))}</span><span className="note-cover-title">{note.title}</span><span className="note-cover-illustration"><span className="note-cover-motif">{theme?.motif ?? "E"}</span><Icon size={48} strokeWidth={1.25} /></span><span className="note-cover-bottom">{locale === "en" ? "MADE FOR LEARNING" : "TEMAN BELAJARMU"}</span></span>
        </button>})}
      </div>
    </div>
    <div className="note-shelf-footer"><div className="note-shelf-caption" aria-live="polite"><span>{selected.subject || (locale === "en" ? "Notes" : "Catatan")}</span><h3>{selected.title}</h3><p>{new Date(selected.createdAt).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", { day: "numeric", month: "long", year: "numeric" })}</p></div><div className="note-shelf-controls"><button type="button" onClick={() => move(-1)} disabled={index === 0} aria-label={locale === "en" ? "Previous book" : "Buku sebelumnya"}><ArrowLeft size={19} /></button><button type="button" onClick={() => move(1)} disabled={index === notes.length - 1} aria-label={locale === "en" ? "Next book" : "Buku berikutnya"}><ArrowRight size={19} /></button><button type="button" className="note-shelf-open" onClick={() => openBook(selected.id)}>{locale === "en" ? "Open book" : "Buka buku"}<ArrowUpRight size={16} /></button></div></div>
    <dialog ref={dialogRef} className="note-reader-dialog" aria-label={selected.title} onClose={() => setOpened(false)} onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      {opened && <div className="note-reader" key={selected.id}>
        <div className="note-reader-toolbar"><span>{locale === "en" ? "EUREKA LIBRARY" : "PERPUSTAKAAN EUREKA"}</span><button type="button" autoFocus onClick={() => dialogRef.current?.close()} aria-label={locale === "en" ? "Close book" : "Tutup buku"}><X size={20} /></button></div>
        {!detailLoading && !detailError && selectedDetails ? <NoteFlipBook title={selected.title} summary={selectedDetails.summary} chapters={chapters} color={themeFor(selected)?.color ?? colorFor(selected.subject)} locale={locale} /> : <div className="note-reader-book">
          <div className="note-reader-cover-animation" style={{ "--reader-color": themeFor(selected)?.color ?? colorFor(selected.subject) } as React.CSSProperties} aria-hidden="true"><BookOpen size={54} /><strong>{selected.title}</strong><small>EUREKA · CATATAN</small></div>
          <div key={chapterId ?? "cover"} className="note-reader-page-turn" aria-hidden="true" />
          <article key={chapterId ?? "summary"} className="note-reader-page note-reader-content">
            <span className="note-reader-kicker">{activeChapter ? `${locale === "en" ? "CHAPTER" : "BAB"} ${chapters.findIndex((chapter) => chapter.id === chapterId) + 1}` : (selected.subject || "CATATAN")}</span>
            <h2 id="note-reader-title">{activeChapter?.title ?? selected.title}</h2>
            <div className="note-reader-text">{detailLoading ? <p role="status">{locale === "en" ? "Loading note…" : "Memuat isi catatan…"}</p> : detailError ? <p role="alert">{locale === "en" ? "Could not load the note." : "Catatan belum bisa dimuat."} <button type="button" className="note-reader-retry" onClick={() => setRetry(value => value + 1)}>{locale === "en" ? "Try again" : "Coba lagi"}</button></p> : activeChapter?.content || selectedDetails?.summary ? <MarkdownView content={activeChapter?.content ?? selectedDetails?.summary ?? ""} /> : <p>{locale === "en" ? "Select a chapter to start reading." : "Pilih bab untuk mulai membaca."}</p>}</div>
            <Link className="note-reader-full-link" href={`/dashboard/note/${selected.id}`}>{locale === "en" ? "Open full note" : "Buka catatan lengkap"} <ArrowUpRight size={15} /></Link>
          </article>
          <nav className="note-reader-page note-reader-toc" aria-label={locale === "en" ? "Table of contents" : "Daftar isi"}>
            <span className="note-reader-kicker">{locale === "en" ? "CONTENTS" : "DAFTAR ISI"}</span><h3>{locale === "en" ? "Your chapters" : "Bab dalam buku"}</h3>
            {detailLoading ? <p role="status">{locale === "en" ? "Loading chapters…" : "Memuat daftar bab…"}</p> : detailError ? <p>{locale === "en" ? "Chapters unavailable." : "Daftar bab belum tersedia."}</p> : chapters.length ? <ol>{chapters.map((chapter, i) => <li key={chapter.id}><button type="button" className={chapterId === chapter.id ? "is-selected" : ""} aria-current={chapterId === chapter.id ? "true" : undefined} onClick={() => setChapterId(chapter.id)}><span>{String(i + 1).padStart(2, "0")}</span><strong>{chapter.title}</strong><ArrowRight size={16} /></button></li>)}</ol> : <p>{locale === "en" ? "This note has no chapters yet." : "Catatan ini belum memiliki bab."}</p>}
          </nav>
        </div>}
      </div>}
    </dialog>
  </section>;
}
