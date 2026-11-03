"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Plus, Search, Pin, LibraryBig, Layers3, X } from "lucide-react";
import { CreateNoteModal } from "@/components/dashboard/CreateNoteModal";
import { NoteItem } from "@/components/dashboard/NoteItem";
import { BackgroundJobPopup } from "@/components/dashboard/BackgroundJobPopup";
import NoteShelf from "@/components/dashboard/NoteShelf";
import { useI18n } from "@/context/LocaleContext";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import type { Note } from "@/lib/types";
import "./notes.css";

export default function NotesPage() {
  const { locale, dict } = useI18n();
  const l = dict.dashboard;
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [sort, setSort] = useState<"newest" | "oldest" | "title">("newest");
  const [modal, setModal] = useState(false);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/notes?userId=${encodeURIComponent(getUserId())}`);
      if (!res.ok) throw new Error("Gagal memuat catatan");
      const payload = await res.json();
      const seen = new Set<string>();
      setNotes((Array.isArray(payload.notes) ? payload.notes as Note[] : []).filter((note) => !seen.has(note.id) && !!seen.add(note.id)));
      setError(false);
    } catch { setError(true); } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    setSubject(new URLSearchParams(window.location.search).get("subject") ?? "");
    void loadNotes();
    const refresh = () => void loadNotes();
    window.addEventListener("note-ready", refresh);
    return () => window.removeEventListener("note-ready", refresh);
  }, [loadNotes]);
  const subjects = useMemo(() => Array.from(new Set(notes.map((note) => note.subject?.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [notes]);
  const pinnedCount = notes.filter((note) => note.pinned).length;
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return notes.filter((note) => (!search || `${note.title} ${note.subject}`.toLowerCase().includes(search)) && (!subject || note.subject?.trim().toLowerCase() === subject.toLowerCase()) && (!pinnedOnly || note.pinned)).sort((a, b) => {
      const pinnedOrder = Number(!!b.pinned) - Number(!!a.pinned);
      if (pinnedOrder) return pinnedOrder;
      if (sort === "title") return a.title.localeCompare(b.title, locale === "en" ? "en" : "id");
      return sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt);
    });
  }, [notes, query, subject, pinnedOnly, sort, locale]);
  const hasFilters = !!query.trim() || !!subject || pinnedOnly;
  const resetFilters = () => { setQuery(""); setSubject(""); setPinnedOnly(false); };
  const togglePin = async (id: string, pinned: boolean) => {
    setNotes((current) => current.map((note) => note.id === id ? { ...note, pinned } : note));
    try {
      const res = await apiFetch(`/api/notes/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned }) });
      if (!res.ok) throw new Error();
    } catch { setNotes((current) => current.map((note) => note.id === id ? { ...note, pinned: !pinned } : note)); alert(l.errPin); }
  };
  const deleteNote = async (id: string) => {
    if (!window.confirm(l.confirmDelete)) return;
    try {
      const res = await apiFetch(`/api/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setNotes((current) => current.filter((note) => note.id !== id));
    } catch { alert(l.errDeleteRetry); }
  };
  return <main className="notes-page">
    <header className="notes-page-header"><div><span className="notes-page-icon"><BookOpen size={23} /></span><h1>{l.yourNotes}</h1><p>{locale === "en" ? "Your learning materials, all in one place." : "Temukan dan pelajari kembali semua catatanmu."}</p></div><button type="button" onClick={() => setModal(true)}><Plus size={18} /> {locale === "en" ? "New note" : "Buat catatan"}</button></header>
    {!loading && !error && notes.length > 0 && <NoteShelf notes={notes} locale={locale} />}
    <section className="notes-overview" aria-label={locale === "en" ? "Notes overview" : "Ringkasan catatan"}>
      {[{ icon: LibraryBig, count: notes.length, label: locale === "en" ? "All notes" : "Total catatan" }, { icon: Layers3, count: subjects.length, label: locale === "en" ? "Subjects" : "Mata pelajaran" }, { icon: Pin, count: pinnedCount, label: locale === "en" ? "Pinned" : "Disematkan" }].map(({ icon: Icon, count, label }) => <div key={label}><span><Icon size={19} /></span><div><strong>{loading || error ? "—" : count}</strong><p>{label}</p></div></div>)}
    </section>
    <section className="notes-library" aria-labelledby="notes-library-title">
      <div className="notes-library-heading"><div><h2 id="notes-library-title">{locale === "en" ? "My library" : "Koleksi catatan"}</h2><p>{loading || error ? (locale === "en" ? "Find your learning materials here." : "Temukan materi belajarmu di sini.") : (locale === "en" ? `${filtered.length} of ${notes.length} notes` : `${filtered.length} dari ${notes.length} catatan`)}</p></div></div>
      <div className="notes-tools"><div className="notes-page-search"><Search size={18} aria-hidden="true" /><input type="search" aria-label={l.searchNotes} placeholder={l.searchNotes} value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <select value={subject} onChange={(event) => setSubject(event.target.value)} aria-label={locale === "en" ? "Filter by subject" : "Filter mata pelajaran"}><option value="">{locale === "en" ? "All subjects" : "Semua mata pelajaran"}</option>{subject && !subjects.some((item) => item.toLowerCase() === subject.toLowerCase()) && <option value={subject}>{subject}</option>}{subjects.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <select value={sort} onChange={(event) => setSort(event.target.value as "newest" | "oldest" | "title")} aria-label={locale === "en" ? "Sort notes" : "Urutkan catatan"}><option value="newest">{locale === "en" ? "Newest" : "Terbaru"}</option><option value="oldest">{locale === "en" ? "Oldest" : "Terlama"}</option><option value="title">{locale === "en" ? "Title A–Z" : "Judul A–Z"}</option></select>
        <button type="button" className="notes-pin-filter" aria-pressed={pinnedOnly} onClick={() => setPinnedOnly((value) => !value)}><Pin size={16} /> {locale === "en" ? "Pinned" : "Disematkan"}</button>
      </div>
      {loading ? <p className="notes-page-empty" role="status">{l.loadingNotes}</p> : error ? <div className="notes-page-empty" role="alert"><span className="notes-empty-icon"><BookOpen size={26} /></span><strong>{locale === "en" ? "Could not load notes" : "Catatan belum bisa dimuat"}</strong><span>{locale === "en" ? "Check your connection and try again." : "Periksa koneksi, lalu coba muat kembali catatanmu."}</span><button type="button" onClick={() => void loadNotes()}>{locale === "en" ? "Try again" : "Coba lagi"}</button></div> : filtered.length === 0 ? <div className="notes-page-empty"><span className="notes-empty-icon"><BookOpen size={26} /></span><strong>{hasFilters ? (locale === "en" ? "No matching notes" : "Catatan tidak ditemukan") : l.noNotes}</strong><span>{hasFilters ? (locale === "en" ? "Try a different search or filter." : "Coba ubah pencarian atau filter.") : l.noNotesDesc}</span>{hasFilters ? <button type="button" onClick={resetFilters}><X size={16} /> {locale === "en" ? "Clear filters" : "Hapus filter"}</button> : <button type="button" onClick={() => setModal(true)}><Plus size={16} /> {locale === "en" ? "Create your first note" : "Buat catatan pertama"}</button>}</div> : <div className="notes-page-grid">{filtered.map((note) => <NoteItem key={note.id} id={note.id} title={note.title} subject={note.subject} updatedAt={new Date(note.createdAt).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", { day: "numeric", month: "short", year: "numeric" })} pinned={!!note.pinned} onTogglePin={(id, pinned) => void togglePin(id, pinned)} onDelete={(id) => void deleteNote(id)} />)}</div>}
    </section>
    <CreateNoteModal open={modal} onClose={() => setModal(false)} onCreate={(note) => { setNotes((current) => [note, ...current.filter((item) => item.id !== note.id)]); setModal(false); setError(false); }} />
    <BackgroundJobPopup />
  </main>;
}
